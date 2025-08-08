import Link from "next/link";
import { XIcon } from "lucide-react";

export const Footer = () => (
  <div className="bg-dashed">
    <div className="container mx-auto flex items-center justify-between p-8 text-muted-foreground">
      <p className=" block text-center text-sm">
        Designed & Built with Love in India for you.
      </p>
      <span className="flex flex-col text-sm space-x-4">

          <Link href="/about" className="hover:underline">
          About
          </Link>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline"> Terms of Service </Link>
          <Link href="/contact" className="hover:underline"> Contact </Link>
      </span>
    </div>
  </div>
);
