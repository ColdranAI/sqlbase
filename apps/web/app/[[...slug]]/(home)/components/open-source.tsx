import { Button } from '@/components/ui/button';
import { StarIcon } from 'lucide-react';

export const OpenSource = () => {
  return (
    <div className="flex h-full flex-col items-start justify-between gap-4 p-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <StarIcon size={14} />
          <small>Gib Feedback</small>
        </div>
        <p className="font-semibold text-xl tracking-tight">
          SQLBase is Lorem Impsum{' '}
          <a
            href="https://vercel.com"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lorem Ipsum
          </a>{' '}
          Lorem Ipsum{' '}
          developed by{' '}
          <a
            href="https://x.com/haydenbleasel"
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arjun Aditya
          </a>
          .
        </p>
      </div>
      <Button asChild variant="default">
        <a
          href="https://github.com/vercel/SQLBase"
          target="_blank"
          rel="noopener noreferrer"
        >
          Send Feedback
        </a>
      </Button>
    </div>
  );
};
