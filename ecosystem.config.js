module.exports = {
  apps: [{
    name: "ma-next",
    cwd: __dirname,
    script: "node_modules/next/dist/bin/next",
    args: "start --hostname 127.0.0.1 --port 3010",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "1G",
    restart_delay: 3000,
    time: true,
    env: {
      NODE_ENV: "production",
      APP_URL: "https://ma.rattanan.dev",
      TRUSTED_ORIGINS: "https://ma.rattanan.dev",
    },
  }],
};
