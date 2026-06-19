package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sort"
)

var errOneForAllNotConnected = errors.New("one-for-all api not connected")

var oneForAllClient = &http.Client{Timeout: oneForAllTimeout}

type oneForAllResponse struct {
	Domain     string   `json:"domain"`
	Count      int      `json:"count"`
	Subdomains []string `json:"subdomains"`
}

func runOneForAll(ctx context.Context, domain string) ([]string, error) {
	if oneForAllBaseURL == "" {
		logWarn("oneforall status=skipped domain=%s reason=missing_url", domain)
		return nil, errOneForAllNotConnected
	}

	payload, err := json.Marshal(discoverRequest{Domain: domain})
	if err != nil {
		return nil, err
	}

	endpoint := oneForAllBaseURL + "/subdomains"
	logInfo("oneforall status=request domain=%s endpoint=%s", domain, endpoint)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		logError("oneforall status=error domain=%s reason=request_build err=%v", domain, err)
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := oneForAllClient.Do(req)
	if err != nil {
		if isConnectionIssue(err) {
			logWarn("oneforall status=not_connected domain=%s endpoint=%s err=%v", domain, endpoint, err)
			return nil, errOneForAllNotConnected
		}
		logError("oneforall status=error domain=%s reason=request_failed err=%v", domain, err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logWarn("oneforall status=error domain=%s reason=bad_status code=%d", domain, resp.StatusCode)
		return nil, fmt.Errorf("oneforall returned status %d", resp.StatusCode)
	}

	var parsed oneForAllResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		logError("oneforall status=error domain=%s reason=decode err=%v", domain, err)
		return nil, fmt.Errorf("decode oneforall response: %w", err)
	}

	uniq := make(map[string]struct{}, len(parsed.Subdomains))
	for _, sub := range parsed.Subdomains {
		if sub == "" {
			continue
		}
		uniq[sub] = struct{}{}
	}

	list := make([]string, 0, len(uniq))
	for sub := range uniq {
		list = append(list, sub)
	}
	sort.Strings(list)
	logInfo("oneforall status=ok domain=%s count=%d", domain, len(list))
	return list, nil
}

func isConnectionIssue(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}

	var urlErr *url.Error
	return errors.As(err, &urlErr)
}
