import { BADGE_CONFIG } from '@/hooks/useCommunity';
import { cn } from '@/lib/utils';

interface Props {
  badge?: string;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md';
}

export default function ReputationBadge({ badge = 'new_trader', score, showScore, size = 'sm' }: Props) {
  const config = BADGE_CONFIG[badge] || BADGE_CONFIG.new_trader;
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', config.color, size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {showScore && score !== undefined && (
        <span className="text-muted-foreground">({score})</span>
      )}
    </span>
  );
}
