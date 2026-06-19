package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

type assetfinderFetchFn func(context.Context, string) ([]string, error)

var assetfinderClient = &http.Client{Timeout: 15 * time.Second}

func runAssetfinder(ctx context.Context, domain string) ([]string, error) {
	sources := []assetfinderFetchFn{
		fetchAssetfinderCertSpotter,
		fetchAssetfinderHackerTarget,
		fetchAssetfinderThreatCrowd,
		fetchAssetfinderCrtSh,
		fetchAssetfinderFacebook,
		fetchAssetfinderVirusTotal,
		fetchAssetfinderFindSubDomains,
		fetchAssetfinderURLScan,
		fetchAssetfinderBufferOverrun,
	}

	out := make(chan string)
	errCh := make(chan error, len(sources))
	var wg sync.WaitGroup
	rateLimiter := newAssetfinderRateLimiter(time.Second)
	lowerDomain := strings.ToLower(domain)

	for _, source := range sources {
		wg.Add(1)
		fn := source
		go func() {
			defer wg.Done()
			if err := rateLimiter.Block(ctx, sourceName(fn)); err != nil {
				errCh <- err
				return
			}

			names, err := fn(ctx, lowerDomain)
			if err != nil {
				return
			}

			for _, name := range names {
				for _, candidate := range splitAssetfinderCandidates(name) {
					cleaned := cleanAssetfinderDomain(candidate)
					if cleaned == "" || !strings.HasSuffix(cleaned, lowerDomain) {
						continue
					}
					select {
					case out <- cleaned:
					case <-ctx.Done():
						errCh <- ctx.Err()
						return
					}
				}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(out)
		close(errCh)
	}()

	uniq := make(map[string]struct{})
	for sub := range out {
		uniq[sub] = struct{}{}
	}

	for err := range errCh {
		if err != nil && (err == context.DeadlineExceeded || err == context.Canceled) {
			return nil, err
		}
	}

	list := make([]string, 0, len(uniq))
	for sub := range uniq {
		list = append(list, sub)
	}
	sort.Strings(list)
	return list, nil
}

func sourceName(fn assetfinderFetchFn) string {
	return fmt.Sprintf("%p", fn)
}

func fetchAssetfinderCertSpotter(ctx context.Context, domain string) ([]string, error) {
	fetchURL := fmt.Sprintf("https://certspotter.com/api/v0/certs?domain=%s", domain)
	wrapper := []struct {
		DNSNames []string `json:"dns_names"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}
	out := make([]string, 0)
	for _, w := range wrapper {
		out = append(out, w.DNSNames...)
	}
	return out, nil
}

func fetchAssetfinderHackerTarget(ctx context.Context, domain string) ([]string, error) {
	raw, err := httpGetWithContext(ctx, fmt.Sprintf("https://api.hackertarget.com/hostsearch/?q=%s", domain))
	if err != nil {
		return nil, err
	}
	out := make([]string, 0)
	sc := bufio.NewScanner(bytes.NewReader(raw))
	for sc.Scan() {
		parts := strings.SplitN(sc.Text(), ",", 2)
		if len(parts) == 2 {
			out = append(out, parts[0])
		}
	}
	return out, sc.Err()
}

func fetchAssetfinderThreatCrowd(ctx context.Context, domain string) ([]string, error) {
	fetchURL := fmt.Sprintf("https://www.threatcrowd.org/searchApi/v2/domain/report/?domain=%s", domain)
	wrapper := struct {
		Subdomains []string `json:"subdomains"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}
	return wrapper.Subdomains, nil
}

func fetchAssetfinderCrtSh(ctx context.Context, domain string) ([]string, error) {
	fetchURL := fmt.Sprintf("https://crt.sh/?q=%%25.%s&output=json", domain)
	wrapper := []struct {
		Name string `json:"name_value"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(wrapper))
	for _, r := range wrapper {
		out = append(out, r.Name)
	}
	return out, nil
}

func fetchAssetfinderFacebook(ctx context.Context, domain string) ([]string, error) {
	appID := os.Getenv("FB_APP_ID")
	appSecret := os.Getenv("FB_APP_SECRET")
	if appID == "" || appSecret == "" {
		return nil, nil
	}

	authURL := fmt.Sprintf("https://graph.facebook.com/oauth/access_token?client_id=%s&client_secret=%s&grant_type=client_credentials", appID, appSecret)
	authResp := struct {
		AccessToken string `json:"access_token"`
	}{}
	if err := fetchJSONWithContext(ctx, authURL, &authResp); err != nil || authResp.AccessToken == "" {
		return nil, err
	}

	nextURL := fmt.Sprintf("https://graph.facebook.com/certificates?fields=domains&access_token=%s&query=*.%s", authResp.AccessToken, domain)
	out := make([]string, 0)
	for nextURL != "" {
		wrapper := struct {
			Data []struct {
				Domains []string `json:"domains"`
			} `json:"data"`
			Paging struct {
				Next string `json:"next"`
			} `json:"paging"`
		}{}
		if err := fetchJSONWithContext(ctx, nextURL, &wrapper); err != nil {
			return out, err
		}
		for _, item := range wrapper.Data {
			out = append(out, item.Domains...)
		}
		nextURL = wrapper.Paging.Next
	}
	return out, nil
}

func fetchAssetfinderVirusTotal(ctx context.Context, domain string) ([]string, error) {
	apiKey := os.Getenv("VT_API_KEY")
	if apiKey == "" {
		return nil, nil
	}
	fetchURL := fmt.Sprintf("https://www.virustotal.com/vtapi/v2/domain/report?domain=%s&apikey=%s", domain, apiKey)
	wrapper := struct {
		Subdomains []string `json:"subdomains"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}
	return wrapper.Subdomains, nil
}

func fetchAssetfinderFindSubDomains(ctx context.Context, domain string) ([]string, error) {
	token := os.Getenv("SPYSE_API_TOKEN")
	if token == "" {
		return nil, nil
	}

	out := make([]string, 0)
	aggregateURL := fmt.Sprintf("https://api.spyse.com/v1/subdomains-aggregate?api_token=%s&domain=%s", token, domain)
	aggregate := struct {
		CIDR struct {
			CIDR16 struct {
				Results []struct {
					Data struct {
						Domains []string `json:"domains"`
					} `json:"data"`
				} `json:"results"`
			} `json:"cidr16"`
			CIDR24 struct {
				Results []struct {
					Data struct {
						Domains []string `json:"domains"`
					} `json:"data"`
				} `json:"results"`
			} `json:"cidr24"`
		} `json:"cidr"`
	}{}
	if err := fetchJSONWithContext(ctx, aggregateURL, &aggregate); err == nil {
		for _, r := range aggregate.CIDR.CIDR16.Results {
			out = append(out, r.Data.Domains...)
		}
		for _, r := range aggregate.CIDR.CIDR24.Results {
			out = append(out, r.Data.Domains...)
		}
	}

	for page := 1; ; page++ {
		pageURL := fmt.Sprintf("https://api.spyse.com/v1/subdomains?api_token=%s&domain=%s&page=%d", token, domain, page)
		pageWrapper := struct {
			Records []struct {
				Domain string `json:"domain"`
			} `json:"records"`
		}{}
		if err := fetchJSONWithContext(ctx, pageURL, &pageWrapper); err != nil {
			break
		}
		if len(pageWrapper.Records) == 0 {
			break
		}
		for _, r := range pageWrapper.Records {
			out = append(out, r.Domain)
		}
	}

	return out, nil
}

func fetchAssetfinderURLScan(ctx context.Context, domain string) ([]string, error) {
	fetchURL := fmt.Sprintf("https://urlscan.io/api/v1/search/?q=domain:%s", domain)
	wrapper := struct {
		Results []struct {
			Task struct {
				URL string `json:"url"`
			} `json:"task"`
			Page struct {
				URL string `json:"url"`
			} `json:"page"`
		} `json:"results"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(wrapper.Results)*2)
	for _, r := range wrapper.Results {
		u, err := url.Parse(r.Task.URL)
		if err == nil {
			out = append(out, u.Hostname())
		}
	}
	for _, r := range wrapper.Results {
		u, err := url.Parse(r.Page.URL)
		if err == nil {
			out = append(out, u.Hostname())
		}
	}
	return out, nil
}

func fetchAssetfinderBufferOverrun(ctx context.Context, domain string) ([]string, error) {
	fetchURL := fmt.Sprintf("https://dns.bufferover.run/dns?q=.%s", domain)
	wrapper := struct {
		Records []string `json:"FDNS_A"`
	}{}
	if err := fetchJSONWithContext(ctx, fetchURL, &wrapper); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(wrapper.Records))
	for _, record := range wrapper.Records {
		parts := strings.SplitN(record, ",", 2)
		if len(parts) == 2 {
			out = append(out, parts[1])
		}
	}
	return out, nil
}

func httpGetWithContext(ctx context.Context, targetURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := assetfinderClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func fetchJSONWithContext(ctx context.Context, targetURL string, wrapper interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return err
	}
	resp, err := assetfinderClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(wrapper)
}

func cleanAssetfinderDomain(domain string) string {
	d := strings.ToLower(strings.TrimSpace(domain))
	if len(d) < 2 {
		return d
	}
	if d[0] == '*' || d[0] == '%' {
		d = d[1:]
	}
	d = strings.TrimPrefix(d, ".")
	return d
}

func splitAssetfinderCandidates(raw string) []string {
	if raw == "" {
		return nil
	}

	normalized := strings.ReplaceAll(raw, `\\n`, "\n")
	parts := strings.FieldsFunc(normalized, func(r rune) bool {
		switch r {
		case '\n', '\r', '\t', ' ', ',', ';':
			return true
		default:
			return false
		}
	})

	if len(parts) == 0 {
		return []string{raw}
	}

	return parts
}

type assetfinderRateLimiter struct {
	mu    sync.Mutex
	delay time.Duration
	ops   map[string]time.Time
}

func newAssetfinderRateLimiter(delay time.Duration) *assetfinderRateLimiter {
	return &assetfinderRateLimiter{
		delay: delay,
		ops:   make(map[string]time.Time),
	}
}

func (r *assetfinderRateLimiter) Block(ctx context.Context, key string) error {
	now := time.Now()
	r.mu.Lock()
	last, ok := r.ops[key]
	if !ok {
		r.ops[key] = now
		r.mu.Unlock()
		return nil
	}
	deadline := last.Add(r.delay)
	if now.After(deadline) {
		r.ops[key] = now
		r.mu.Unlock()
		return nil
	}
	wait := deadline.Sub(now)
	r.ops[key] = now.Add(wait)
	r.mu.Unlock()

	timer := time.NewTimer(wait)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
