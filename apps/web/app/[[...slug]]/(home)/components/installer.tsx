'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';

export const Waitlist = () => {
  const [email, setEmail] = useState('');

  const handleJoinWaitlist = () => {
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    // Here you would typically make an API call to add the email to your waitlist
    // For now, we'll just show a success message
    toast.success('Successfully joined the waitlist!');
    setEmail('');
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        placeholder="Enter your email to join the waitlist..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="resize-none"
        rows={1}
      />
      <Button onClick={handleJoinWaitlist} size="lg" className="w-full">
        Join Waitlist
      </Button>
    </div>
  );
};
