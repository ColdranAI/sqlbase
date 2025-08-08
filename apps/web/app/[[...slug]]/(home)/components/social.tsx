import { Tweet } from 'react-tweet';

const tweets = [
  '1853560800050651632',
  '1853447982781239383',
  '1853242495540363750',
];

export const Social = () => (
  <section className="grid sm:grid-cols-3 sm:divide-x" id="community">
    <div className="hidden bg-dashed sm:block">
      <div className="sticky top-14 grid gap-2 p-8">
        <h2 className="font-semibold text-4xl">Loved by the community</h2>
        <p className="text-muted-foreground">
          See what people are saying about SQLBase.
        </p>
      </div>
    </div>
    <div className="columns-1 gap-4 p-8 sm:col-span-2 md:columns-2">
      {tweets.map((tweet, index) => (
        <div key={tweet} className={index ? '' : 'sm:-mt-6'}>
          <Tweet id={tweet} />
        </div>
      ))}
    </div>
  </section>
);
