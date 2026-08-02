import { Rocket, Sparkles, Zap } from "lucide-react";
import { cn } from "../lib/utils";

interface FrontDoorProps {
  onChoose: (path: "starter" | "create" | "grow") => void;
}

export function FrontDoor({ onChoose }: FrontDoorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome to Sysdom AI
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          How would you like to get started?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-3xl w-full sm:grid-cols-3">
        <button
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6",
            "hover:border-foreground hover:bg-accent/30 transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("starter")}
        >
          <div className="rounded-full bg-muted/50 p-3 group-hover:bg-accent transition-colors">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Start with SIM Starter</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Create a CEO, four engine leads, and a SIM Wiki-ready Sprint Zero without configuring agents by hand.
            </p>
          </div>
        </button>

        <button
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6",
            "hover:border-foreground hover:bg-accent/30 transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("create")}
        >
          <div className="rounded-full bg-muted/50 p-3 group-hover:bg-accent transition-colors">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Blank setup</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Start from a clean company and choose each lead, adapter, and model yourself.
            </p>
          </div>
        </button>

        <button
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-border p-6",
            "hover:border-foreground hover:bg-accent/30 transition-all",
            "text-center group cursor-pointer",
          )}
          onClick={() => onChoose("grow")}
        >
          <div className="rounded-full bg-muted/50 p-3 group-hover:bg-accent transition-colors">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Add agents to your org</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Bring AI agents into your existing team or workflows.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
