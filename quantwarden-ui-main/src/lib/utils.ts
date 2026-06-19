import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRoleStyle(roleIdOrName: string, orgRoles: any[] = []): React.CSSProperties {
  const rLowercase = roleIdOrName.toLowerCase();
  
  // Find the role either by ID or name
  const roleObj = orgRoles.find(r => 
    r.id === roleIdOrName || 
    r.name.toLowerCase() === rLowercase
  );

  let hex = "#eab308"; // Fallback amber

  if (roleObj?.permissions?.color) {
    hex = roleObj.permissions.color;
  } else {
    // Determine default fallback colors based on system name if missing from DB
    if (rLowercase === "owner") hex = "#8B0000";
    else if (rLowercase.includes("admin")) hex = "#b91c1c"; // red-700 approx
    else if (rLowercase === "member") hex = "#1d4ed8"; // blue-700 approx
    else if (rLowercase.includes("auditor")) hex = "#047857"; // emerald-700 approx
    else if (rLowercase.includes("analyst")) hex = "#c2410c"; // orange-700 approx
    else hex = "#6b21a8"; // purple-700 approx for custom roles without color
  }

  // Add hex transparency helper (e.g. "1A" for ~10% opacity, "33" for ~20% opacity)
  return {
    color: hex,
    backgroundColor: `${hex}1A`, // 10% opacity
    borderColor: `${hex}40`      // 25% opacity
  };
}
