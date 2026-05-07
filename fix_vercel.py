import json

# Write vercel.json at root level (not inside frontend - Vercel reads from root)
vercel_config = {
    "buildCommand": "cd frontend && npm run build",
    "outputDirectory": "frontend/.next",
    "framework": "nextjs"
}
with open('vercel.json', 'w') as f:
    json.dump(vercel_config, f, indent=2)
    f.write('\n')
print('vercel.json written')

# Also write a simple next.config.js without experimental junk
content = '''/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001",
  },
};

module.exports = nextConfig;
'''
with open('frontend/next.config.js', 'w', newline='\n') as f:
    f.write(content)
print('next.config.js written')
print('All done')
