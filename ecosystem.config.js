// PM2 process description for this Next.js app on Windows.
//
// `script` points at Next's own JS entrypoint and `interpreter: "node"` makes
// PM2 run it with node. Do NOT go back to `script: "cmd"` +
// `args: "/c node_modules\\.bin\\next.cmd start"`: PM2 then tracks cmd.exe and
// the real node process becomes an unmanaged grandchild. The symptoms are a
// fake 4 MB memory reading, wrong CPU, and a `pm2 stop` that leaves the child
// alive holding the port.
//
// `cwd` is the deployment folder, NOT the repository. It must be the directory
// where `pnpm build` produced `.next`.
//
// The PORT has to differ from comercial-web's. Two PM2 apps may share the
// daemon and the machine, but never a listening port.
//
// Credentials are NOT here. `next start` loads `.env` (and `.env.local` before
// it) from `cwd`, which is where DATABASE_URL and AUTH_SECRET must live on the
// target machine.
module.exports = {
  apps: [
    {
      name: "comercial-manager",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      cwd: "C:\\apps\\comercial-manager",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      // One process only: Next keeps its own caches in memory, so fork mode
      // (the default) with a single instance is what `next start` expects.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      // Timestamps in ~/.pm2/logs/comercial-manager-*.log
      time: true,
    },
  ],
}
