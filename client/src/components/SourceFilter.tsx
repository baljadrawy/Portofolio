import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export interface Source {
  id: string;
  name: string;
  type: 'wallet' | 'exchange';
}

interface SourceFilterProps {
  sources: Source[];
  selectedSources: string[];
  onToggleSource: (id: string) => void;
  onSelectAll: () => void;
}

export function SourceFilter({ sources, selectedSources, onToggleSource, onSelectAll }: SourceFilterProps) {
  const allSelected = selectedSources.length === sources.length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Filter by Source</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            console.log('Select all clicked');
            onSelectAll();
          }}
          data-testid="button-select-all"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </div>
      <div className="space-y-2">
        {sources.map((source) => {
          const isSelected = selectedSources.includes(source.id);
          return (
            <button
              key={source.id}
              onClick={() => {
                console.log('Toggle source', source.id);
                onToggleSource(source.id);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-md border transition-colors hover-elevate ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border'
              }`}
              data-testid={`button-source-${source.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                  isSelected ? 'border-primary bg-primary' : 'border-border'
                }`}>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                </div>
                <span className="font-medium">{source.name}</span>
              </div>
              <span className="text-xs text-muted-foreground capitalize">{source.type}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
