import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Shield, Droplets, BarChart3, Microscope } from "lucide-react";
import {
  VALIDATION_RULES,
  CATEGORY_LABELS,
  type ValidationRuleToggles as Toggles,
  type ValidationRuleConfig,
  type TuningLevel,
} from "@/lib/validationRuleConfig";

interface ValidationRuleTogglesProps {
  toggles: Toggles;
  onToggle: (ruleKey: string, enabled: boolean) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  safety: <Shield className="w-4 h-4 text-destructive" />,
  liquidity: <Droplets className="w-4 h-4 text-primary" />,
  market: <BarChart3 className="w-4 h-4 text-warning" />,
  advanced: <Microscope className="w-4 h-4 text-accent-foreground" />,
};

const TUNING_CONFIG: Record<TuningLevel, { emoji: string; label: string; className: string }> = {
  never_disable: { emoji: '🔴', label: 'Never disable', className: 'text-destructive bg-destructive/10 border-destructive/20' },
  safe_to_relax: { emoji: '🟡', label: 'Safe to relax', className: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  optional: { emoji: '🟢', label: 'Optional', className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
};

function RuleRow({ rule, enabled, onToggle }: { rule: ValidationRuleConfig; enabled: boolean; onToggle: (v: boolean) => void }) {
  const tuning = TUNING_CONFIG[rule.tuning];
  
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/30 transition-colors">
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{rule.label}</span>
          {rule.critical && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              Critical
            </Badge>
          )}
          <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${tuning.className}`}>
            {tuning.emoji} {tuning.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{rule.description}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-success shrink-0"
      />
    </div>
  );
}

export default function ValidationRuleTogglesPanel({ toggles, onToggle }: ValidationRuleTogglesProps) {
  const categories = ['safety', 'liquidity', 'market', 'advanced'] as const;

  const enabledCount = Object.values(toggles).filter(Boolean).length;
  const totalCount = VALIDATION_RULES.length;
  const disabledNeverDisable = VALIDATION_RULES.filter(r => r.tuning === 'never_disable' && !toggles[r.key]);
  const disabledCritical = VALIDATION_RULES.filter(r => r.critical && !toggles[r.key]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Validation Rules</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{enabledCount}/{totalCount} active</Badge>
            <div className="hidden sm:flex gap-1.5">
              {Object.entries(TUNING_CONFIG).map(([key, config]) => (
                <span key={key} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${config.className}`}>
                  {config.emoji} {config.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {disabledNeverDisable.length > 0 && (
          <div className="flex items-start gap-2 p-3 mx-3 mt-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">
                {disabledNeverDisable.length} 🔴 "Never disable" rule{disabledNeverDisable.length > 1 ? 's' : ''} turned off
              </p>
              <p className="text-[10px] text-destructive/80 mt-0.5">
                {disabledNeverDisable.map(r => r.label).join(', ')} — these protect against catastrophic losses
              </p>
            </div>
          </div>
        )}

        {disabledCritical.length > 0 && disabledNeverDisable.length === 0 && (
          <div className="flex items-start gap-2 p-3 mx-3 mt-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">
                {disabledCritical.length} critical rule{disabledCritical.length > 1 ? 's' : ''} disabled
              </p>
              <p className="text-[10px] text-destructive/80 mt-0.5">
                {disabledCritical.map(r => r.label).join(', ')} — disabling these significantly increases risk
              </p>
            </div>
          </div>
        )}

        {/* Category groups in 2-column grid on desktop */}
        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {categories.map(cat => {
            const rules = VALIDATION_RULES.filter(r => r.category === cat);
            const catInfo = CATEGORY_LABELS[cat];
            const catEnabled = rules.filter(r => toggles[r.key]).length;
            
            return (
              <div key={cat} className="rounded-lg border border-border/20 bg-secondary/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    {CATEGORY_ICONS[cat]}
                    <span className="text-xs font-semibold text-foreground">{catInfo.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{catEnabled}/{rules.length}</span>
                </div>
                <div className="divide-y divide-border/10">
                  {rules.map(rule => (
                    <RuleRow
                      key={rule.key}
                      rule={rule}
                      enabled={toggles[rule.key] ?? true}
                      onToggle={(v) => onToggle(rule.key, v)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
