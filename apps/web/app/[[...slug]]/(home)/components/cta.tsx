const users = [
  {
    uuid: "9b6d4d86-1522-4e3d-a015-b7e2e0d4db87",
    username: "nermalcat",
    name: "Nermal Cat",
    email: "meow@nermalcat69.dev",
  },
  {
    uuid: "b2c2cf71-6b70-4957-9c0e-5fcfba5a29ae",
    username: "nermal_go_easy",
    name: "Arjun Aditya",
    email: "hayden@vercel.com",
  },
  {
    uuid: "f9376b89-7c11-4011-a1f0-6f7bcmad03d0",
    username: "anzu.jk",
    name: "Jaskirat Johal",
    email: "jaskirat@anzu.io",
  },
  {
    uuid: "f9376b89-7c11-4011-a1f0-6f7bcbad03c0",
    username: "0xninja",
    name: "Abhimanyu Sharma",
    email: "abhimanyu@0xninja.com",
  },
  {
    uuid: "f9376b89-7c11-4011-a1f0-6f7bcbad03b0",
    username: "shuvanita.das",
    name: "Shuvanita Das",
    email: "me@shuvanita.com",
  },
  {
    uuid: "f9376b89-7c11-4011-a1f0-6f7bcbad03f0",
    username: "twishasaigal",
    name: "Twisha Saigal",
    email: "hey@twisha.me",
  },
];

export const CallToAction = () => (
<div className="text-white text-sm">
  <div className="overflow-x-auto">
    <table className="min-w-full ">
      <thead className="bg-neutral-900">
        <tr>
          <th className="text-left px-4 py-2">UUID</th>
          <th className="text-left px-4 py-2">Username</th>
          <th className="text-left px-4 py-2">Name</th>
          <th className="text-left px-4 py-2">Email</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.uuid} className="border-t border-neutral-800 hover:bg-neutral-800/40">
            <td className="px-4 py-2 font-mono text-xs">{user.uuid}</td>
            <td className="px-4 py-2">{user.username}</td>
            <td className="px-4 py-2">{user.name}</td>
            <td className="px-4 py-2 text-neutral-400">{user.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
);
