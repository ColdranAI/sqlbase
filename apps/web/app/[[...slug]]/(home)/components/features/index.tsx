"use client"

import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

import BaseHub from './basehub.svg';
import BetterStack from './better-stack.svg';
import Clerk from './clerk.svg';
import GoogleAnalytics from './google-analytics.svg';
import Prisma from './prisma.svg';
import Radix from './radix.svg';

import Arcjet from './arcjet.svg';
import Lucide from './lucide.svg';
import Neon from './neon.svg';
import React from './react.svg';
import Ultracite from './ultracite.svg';
import Vercel from './vercel.svg';

import { cn } from '@/lib/utils';

const rows = [
  {
    label: 'Neon',
    src: Neon,
    className: '[animation-delay:-38s] [animation-duration:60s]',
  },
  {
    label: 'Neon',
    src: Neon,
    className: '[animation-delay:-38s] [animation-duration:60s]',
  },
  {
    label: 'Neon',
    src: Neon,
    className: '[animation-delay:-38s] [animation-duration:60s]',
  },
  {
    label: 'Neon',
    src: Neon,
    className: '[animation-delay:-38s] [animation-duration:60s]',
  }
];

const AnimatedText = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.9", "start 0.1"]
  });

  const letters = text.split('');
  
  // Create all color transforms upfront to avoid hooks in loops
  const letterColorTransforms = letters.map((_, index) => {
    const letterProgress = index / letters.length;
    const startTrigger = letterProgress * 0.3;
    const endTrigger = Math.min(0.7, startTrigger + 0.2);
    
    return useTransform(
      scrollYProgress,
      [startTrigger, endTrigger],
      ["rgb(38, 38, 38)", "rgb(224, 224, 224)"]
    );
  });
  
  return (
    <div ref={containerRef}>
      {letters.map((letter, index) => (
        <motion.span
          key={index}
          className="inline-block transition-all duration-200"
          initial={{ color: "rgb(38, 38, 38)" }}
          style={{
            color: letterColorTransforms[index]
          }}
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </div>
  );
};

export const Features = () => (
  <section className="dark h-[400px] sm:h-[600px]" id="features">
    <div
      aria-hidden="true"
      className="relative h-full overflow-hidden bg-background py-12 ring-inset sm:py-16"
    >
      <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 mx-auto w-full max-w-[90%] text-center">
        <div className="relative z-10">
          <div className="mx-auto mt-2 italic max-w-3xl text-pretty font-semibold text-3xl tracking-tight sm:text-5xl md:text-5xl">
            <AnimatedText text="Built for you to visualize & analyze your db." />
          </div>
        </div>
      </div>
      {/* <div className="absolute inset-0 grid grid-cols-1 pt-0 [container-type:inline-size]">
        {rows.map((rowData, index) => (
          <div className="group relative" key={index}>
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[length:12px_100%] bg-gradient-to-r from-[2px] from-background/15 to-[2px] dark:from-foreground/15" />
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[length:12px_100%] bg-gradient-to-r from-[2px] from-background/5 to-[2px] group-last:hidden dark:from-foreground/5" />
            {rowData.row.map((logo, _logoIndex) => (
              <div
                key={logo.label}
                className={cn(
                  logo.className,
                  'absolute top-[50px] flex items-center gap-2 whitespace-nowrap px-3 py-1',
                  'rounded-full bg-gradient-to-t from-50% from-secondary/50 to-secondary/50 ring-1 ring-background/10 ring-inset backdrop-blur-sm dark:from-background/50 dark:to-secondary/50 dark:ring-foreground/10',
                  '[--move-x-from:-100%] [--move-x-to:calc(100%+100cqw)] [animation-iteration-count:infinite] [animation-name:move-x] [animation-play-state:running] [animation-timing-function:linear]',
                  'shadow-[0_0_15px_rgba(255,255,255,0.1)] dark:shadow-[0_0_15px_rgba(0,0,0,0.2)]'
                )}
              >
                <Image alt="" src={logo.src} className="size-4" />
                <span className="font-medium text-foreground text-sm/6">
                  {logo.label}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div> */}
    </div>
  </section>
);
