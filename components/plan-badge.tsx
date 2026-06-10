import type { ReactNode } from 'react';

type Plan = 'basic' | 'enterprise';

interface PlanBadgeProps {
  plans: Plan[];
}

const planStyles: Record<Plan, { bg: string; text: string; label: string }> = {
  basic: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Basic',
  },
  enterprise: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    label: 'Enterprise',
  },
};

export function PlanBadge({ plans }: PlanBadgeProps): ReactNode {
  if (plans.length === 0) return null;

  return (
    <div className="flex gap-2 mb-4">
      {plans.map((plan) => {
        const style = planStyles[plan];
        return (
          <span
            key={plan}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
          >
            {style.label}
          </span>
        );
      })}
    </div>
  );
}
