import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { SmartFieldValidation, SmartValidationStatus } from '../../utils/smartExtractor/smartDocTypes';

interface SmartValidationBadgeProps {
  validation?: SmartFieldValidation;
  status?: SmartValidationStatus;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const SmartValidationBadge: React.FC<SmartValidationBadgeProps> = ({
  validation,
  status: directStatus,
  message: directMessage,
  size = 'md',
  showLabel = true,
}) => {
  const status = validation ? validation.status : (directStatus || 'valid');
  const message = validation?.message || directMessage;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-xs px-2.5 py-1 gap-2 font-semibold',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  if (status === 'valid') {
    return (
      <span
        title={message || 'Campo auditado e 100% válido'}
        className={`inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20 ${sizeClasses[size]}`}
      >
        <CheckCircle2 className={`${iconSizes[size]} text-emerald-500 shrink-0`} />
        {showLabel && <span>{message || 'Validado'}</span>}
      </span>
    );
  }

  if (status === 'warning') {
    return (
      <span
        title={message || 'Requer conferência do operador'}
        className={`inline-flex items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20 ${sizeClasses[size]}`}
      >
        <AlertTriangle className={`${iconSizes[size]} text-amber-500 shrink-0`} />
        {showLabel && <span>{message || 'Conferir'}</span>}
      </span>
    );
  }

  return (
    <span
      title={message || 'Inválido ou ausente'}
      className={`inline-flex items-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium border border-rose-500/20 ${sizeClasses[size]}`}
    >
      <AlertCircle className={`${iconSizes[size]} text-rose-500 shrink-0`} />
      {showLabel && <span>{message || 'Inválido'}</span>}
    </span>
  );
};
