import { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: string | ReactNode;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-lg shadow-md p-6 border border-gray-200',
          className
        )}
        {...props}
      >
        {title && (
          <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;

