import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "accent" | "success";
}

const variantStyles = {
  default: "from-primary/15 to-primary/5",
  accent: "from-accent/15 to-accent/5",
  success: "from-success/15 to-success/5",
};


const StatCard = ({ label, value, sub, variant = "default" }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("glass-card rounded-xl p-5 bg-gradient-to-br", variantStyles[variant])}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="w-2 h-2 rounded-full bg-black border-2 border-white shrink-0" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
    <p className="text-2xl font-display font-bold">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </motion.div>
);

export default StatCard;
