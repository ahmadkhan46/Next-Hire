"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Sparkles, User } from "lucide-react";

interface SearchResult {
  id: string;
  similarity: number;
  data: {
    fullName: string;
    email: string;
    currentTitle: string;
  };
}

export function SemanticSearch({ orgId }: { orgId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/semantic-search?query=${encodeURIComponent(query)}&limit=10`
      );
      const data = await res.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold">Semantic Search</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Search candidates by meaning, not just keywords. Try "experienced React developer" or "backend engineer with cloud experience"
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., senior frontend developer with React experience"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Found {results.length} similar candidates
          </div>
          {results.map((result) => (
            <Card key={result.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <User className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium">{result.data.fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      {result.data.currentTitle || 'No title'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.data.email}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-purple-600">
                    {(result.similarity * 100).toFixed(0)}% match
                  </div>
                  <div className="text-xs text-muted-foreground">similarity</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && query && !loading && (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            No candidates found. Try a different search query.
          </div>
        </Card>
      )}
    </div>
  );
}
