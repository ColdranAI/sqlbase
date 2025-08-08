import { Apps } from './components/apps';
import { CallToAction } from './components/cta';
import { Features } from './components/features';
import { Footer } from './components/footer';
import { Hero } from './components/hero';
import { OpenSource } from './components/open-source';
import { Review } from './components/review';
import { Social } from './components/social';
import { QueryMarquee } from '@/components/marquee';

const Home = () => (
  <main className="divide-y px-0">
    <Hero />
    <div className="h-8 bg-dashed border-t" />
    <QueryMarquee />
    <Apps />
    <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <div className="sm:col-span-2">
        <Review />
      </div>
      <div className="sm:col-span-1">
        <OpenSource />
      </div>
    </div>
    <Features />
    {/* <Social /> */}
    <CallToAction />
    <Footer />
  </main>
);

export default Home;
