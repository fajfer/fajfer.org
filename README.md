## Usage
1. Install dependencies: `npm ci`
2. Start development server: `npm run dev`
3. Build `npm run build`
4. Deploy via `rsync -av public/ vegeta:/var/www/blog.fajfer.org`

## nginx
Redirects from the old blog
```
server {
    server_name blog.fajfer.org www.blog.fajfer.org;

    ...

    location = /2023/09/16/running-green-cell-ups-app-gcups-on-gnu-linux-server/ {
        return 301 https://blog.fajfer.org/en/blog/gcups/;
    }

    location = /2023/07/23/cosign-signatures-lifecycle-in-artifactory/ {
        return 301 https://blog.fajfer.org/en/blog/cosign-artifactory/;
    }
}
```