package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"sync"
)

var domainPattern = regexp.MustCompile(`^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

type statusResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

type discoverRequest struct {
	Domain string `json:"domain"`
}

type discoverResponse struct {
	Domain        string   `json:"domain"`
	Count         int      `json:"count"`
	Subdomains    []string `json:"subdomains"`
	Sources       sources  `json:"sources,omitempty"`
	Info          string   `json:"info,omitempty"`
	Message       string   `json:"message,omitempty"`
	TimedOutTools []string `json:"timed_out_tools,omitempty"`
}

type sources struct {
	Subfinder int `json:"subfinder"`
	Assent    int `json:"assent"`
	OneForAll int `json:"oneforall"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	respondJSON(w, http.StatusOK, statusResponse{
		Status:  "ok",
		Service: serviceName,
	})
}

func subdomainsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req, ok := decodeDiscoverRequest(w, r)
	if !ok {
		return
	}

	res := runCombinedDiscovery(r.Context(), req.Domain)
	if res.AllFailed {
		respondJSON(w, http.StatusBadGateway, errorResponse{Error: res.Message})
		return
	}

	respondJSON(w, http.StatusOK, discoverResponse{
		Domain:        req.Domain,
		Count:         len(res.Subdomains),
		Subdomains:    res.Subdomains,
		Sources:       res.Sources,
		Info:          res.Info,
		Message:       res.Message,
		TimedOutTools: res.TimedOutTools,
	})
}

func subfinderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req, ok := decodeDiscoverRequest(w, r)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), subfinderTimeout)
	defer cancel()

	subs, err := runSubfinder(ctx, req.Domain)
	if err != nil {
		handleSubfinderError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, discoverResponse{
		Domain:     req.Domain,
		Count:      len(subs),
		Subdomains: subs,
	})
}

func assetfinderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req, ok := decodeDiscoverRequest(w, r)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), assetfinderTimeout)
	defer cancel()

	subs, err := runAssetfinder(ctx, req.Domain)
	if err != nil {
		handleAssetfinderError(w, err)
		return
	}

	respondJSON(w, http.StatusOK, discoverResponse{
		Domain:     req.Domain,
		Count:      len(subs),
		Subdomains: subs,
	})
}

func decodeDiscoverRequest(w http.ResponseWriter, r *http.Request) (discoverRequest, bool) {
	var req discoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid JSON body"})
		return discoverRequest{}, false
	}

	req.Domain = strings.TrimSpace(req.Domain)
	if !validDomain(req.Domain) {
		respondJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid domain"})
		return discoverRequest{}, false
	}

	return req, true
}

type combinedResult struct {
	Subdomains    []string
	TimedOutTools []string
	Sources       sources
	Info          string
	Message       string
	AllFailed     bool
}

type toolResult struct {
	Name       string
	Subdomains []string
	Err        error
}

func runCombinedDiscovery(parent context.Context, domain string) combinedResult {
	ctx, cancel := context.WithTimeout(parent, combinedTimeout)
	defer cancel()

	runners := []struct {
		name string
		run  func(context.Context, string) ([]string, error)
	}{
		{name: "subfinder", run: runSubfinder},
		{name: "assetfinder", run: runAssetfinder},
		{name: "oneforall", run: runOneForAll},
	}

	resultsCh := make(chan toolResult, len(runners))
	var wg sync.WaitGroup

	for _, runner := range runners {
		wg.Add(1)
		r := runner
		go func() {
			defer wg.Done()
			subs, err := r.run(ctx, domain)
			resultsCh <- toolResult{Name: r.name, Subdomains: subs, Err: err}
		}()
	}

	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	merged := make(map[string]struct{})
	timedOutTools := make([]string, 0)
	errs := make([]string, 0)
	successes := 0
	src := sources{}
	info := ""

	for res := range resultsCh {
		if res.Err != nil {
			logWarn("discovery source=%s domain=%s status=error err=%v", res.Name, domain, res.Err)

			if res.Name == "oneforall" && errors.Is(res.Err, errOneForAllNotConnected) {
				info = "one-for-all api not connected"
				continue
			}

			if errors.Is(res.Err, context.DeadlineExceeded) || (errors.Is(res.Err, context.Canceled) && errors.Is(ctx.Err(), context.DeadlineExceeded)) {
				timedOutTools = append(timedOutTools, res.Name)
				errs = append(errs, fmt.Sprintf("%s timed out", res.Name))
				continue
			}

			errs = append(errs, fmt.Sprintf("%s failed: %v", res.Name, res.Err))
			continue
		}

		successes++
		logInfo("discovery source=%s domain=%s status=ok count=%d", res.Name, domain, len(res.Subdomains))
		switch res.Name {
		case "subfinder":
			src.Subfinder = len(res.Subdomains)
		case "assetfinder":
			src.Assent = len(res.Subdomains)
		case "oneforall":
			src.OneForAll = len(res.Subdomains)
		}

		for _, sub := range res.Subdomains {
			merged[sub] = struct{}{}
		}
	}

	list := make([]string, 0, len(merged))
	for sub := range merged {
		list = append(list, sub)
	}
	sort.Strings(list)
	sort.Strings(timedOutTools)

	msg := ""
	if len(errs) > 0 {
		msg = strings.Join(errs, "; ")
	}
	logInfo(
		"discovery domain=%s status=complete total=%d sources=subfinder:%d assent:%d oneforall:%d timed_out=%v info=%q",
		domain,
		len(list),
		src.Subfinder,
		src.Assent,
		src.OneForAll,
		timedOutTools,
		info,
	)

	return combinedResult{
		Subdomains:    list,
		TimedOutTools: timedOutTools,
		Sources:       src,
		Info:          info,
		Message:       msg,
		AllFailed:     successes == 0,
	}
}

func handleSubfinderError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		respondJSON(w, http.StatusGatewayTimeout, errorResponse{Error: "subfinder timed out"})
	default:
		respondJSON(w, http.StatusBadGateway, errorResponse{Error: err.Error()})
	}
}

func handleAssetfinderError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		respondJSON(w, http.StatusGatewayTimeout, errorResponse{Error: "assetfinder timed out"})
	default:
		respondJSON(w, http.StatusBadGateway, errorResponse{Error: err.Error()})
	}
}

func validDomain(domain string) bool {
	if domain == "" || len(domain) > 253 {
		return false
	}
	if strings.HasPrefix(domain, "-") || strings.HasSuffix(domain, "-") {
		return false
	}
	return domainPattern.MatchString(domain)
}

func respondJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		logError("failed to write JSON response: %v", err)
	}
}
