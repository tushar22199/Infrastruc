import {
  useListEngineers,
  getListEngineersQueryKey,
  useAssignInspection,
  getGetInspectionQueryKey,
  getListInspectionsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { UserCheck, UserPlus, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface AssignPanelProps {
  inspectionId: number;
  currentAssignedTo?: string | null;
  currentAssignedToName?: string | null;
}

export function AssignPanel({
  inspectionId,
  currentAssignedTo,
  currentAssignedToName,
}: AssignPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: engineers = [] } = useListEngineers({
    query: { queryKey: getListEngineersQueryKey() },
  });

  const assign = useAssignInspection({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(
          getGetInspectionQueryKey(inspectionId),
          (old: unknown) =>
            old && typeof old === "object"
              ? {
                  ...(old as object),
                  assignedTo: data.assignedTo,
                  assignedToName: data.assignedToName,
                }
              : old,
        );

        queryClient.invalidateQueries({
          queryKey: getListInspectionsQueryKey(),
        });

        const name = data.assignedToName ?? "engineer";

        toast({
          title: "Assigned",
          description: `Inspection assigned to ${name}. They've been notified.`,
        });
      },
      onError: () => {
        toast({
          title: "Assignment Failed",
          description: "Could not assign inspection.",
          variant: "destructive",
        });
      },
    },
  });

  function handleAssign(userId: string, displayName: string) {
    assign.mutate({
      id: inspectionId,
      data: { userId, displayName },
    });
  }

  function handleUnassign() {
    assign.mutate({
      id: inspectionId,
      data: {
        userId: "",
        displayName: "",
      },
    });
  }

  const isAssigned = !!currentAssignedTo && currentAssignedTo !== "";
  const isAssignedToMe = user && currentAssignedTo === user.id;

  // Include current user at the top if not already in engineer list.
  const myEntry =
    user && !engineers.some((e) => e.userId === user.id)
      ? [
          {
            userId: user.id,
            displayName:
              `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
              user.email ||
              "Me",
          },
        ]
      : [];

  const allEngineers = [...myEntry, ...engineers];

  const canAssign = user?.role === "ADMIN";

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-bold">
        Assigned Engineer
      </div>

      {isAssigned ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-md flex-1 min-w-0">
            <UserCheck className="h-4 w-4 flex-shrink-0" />

            <span className="text-sm font-semibold truncate">
              {currentAssignedToName ?? currentAssignedTo}

              {isAssignedToMe && (
                <span className="ml-1.5 text-[10px] font-mono bg-primary/20 px-1 py-0.5 rounded">
                  YOU
                </span>
              )}
            </span>
          </div>

          {canAssign && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  disabled={assign.isPending}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                {allEngineers.map((eng) => (
                  <DropdownMenuItem
                    key={eng.userId}
                    onClick={() =>
                      handleAssign(eng.userId, eng.displayName)
                    }
                    className={`text-xs cursor-pointer ${
                      eng.userId === currentAssignedTo
                        ? "font-bold text-primary"
                        : ""
                    }`}
                  >
                    {eng.userId === user?.id
                      ? `${eng.displayName} (You)`
                      : eng.displayName}

                    {eng.userId === currentAssignedTo && " ✓"}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleUnassign}
                  className="text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <X className="h-3 w-3 mr-2" />
                  Unassign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : canAssign ? (
        <div className="flex gap-2">
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold uppercase tracking-wider"
              disabled={assign.isPending}
              onClick={() =>
                handleAssign(
                  user.id,
                  `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
                    user.email ||
                    "Engineer",
                )
              }
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign to Me
            </Button>
          )}

          {allEngineers.filter((e) => e.userId !== user?.id).length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-xs uppercase tracking-wider"
                  disabled={assign.isPending}
                >
                  Assign to…
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-52">
                {allEngineers
                  .filter((e) => e.userId !== user?.id)
                  .map((eng) => (
                    <DropdownMenuItem
                      key={eng.userId}
                      onClick={() =>
                        handleAssign(eng.userId, eng.displayName)
                      }
                      className="text-xs cursor-pointer"
                    >
                      {eng.displayName}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {allEngineers.length === 0 && !user && (
            <p className="text-xs text-muted-foreground italic">
              No engineers available yet.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Not assigned
        </p>
      )}
    </div>
  );
}