package main

import (
	"context"
	"sort"

	"github.com/projectdiscovery/subfinder/v2/pkg/runner"
)

func runSubfinder(ctx context.Context, domain string) ([]string, error) {
	options := &runner.Options{
		Threads:            10,
		Timeout:            30,
		MaxEnumerationTime: 20,
		RemoveWildcard:     true,
		Silent:             true,
		DisableUpdateCheck: true,
	}

	r, err := runner.NewRunner(options)
	if err != nil {
		return nil, err
	}

	results, err := r.EnumerateSingleDomainWithCtx(ctx, domain, nil)
	if err != nil {
		return nil, err
	}

	subs := collectSubdomains(results)
	return subs, nil
}

func collectSubdomains(results map[string]map[string]struct{}) []string {
	uniq := make(map[string]struct{})
	for sub := range results {
		uniq[sub] = struct{}{}
	}

	list := make([]string, 0, len(uniq))
	for sub := range uniq {
		list = append(list, sub)
	}
	sort.Strings(list)
	return list
}
