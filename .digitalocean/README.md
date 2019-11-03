This is a short guide for running the Routr in DigitalOcean cloud services

## Requirements

- Git
- Packer
- A DigitalOcean Account

## Steps

&#10122; Clone Routr 

```bash
git clone https://github.com/fonoster/routr
```

&#10123; Build a DigitalOcean image

```bash
cd .digitalocean
packer build marketplace-image.json 
```

Finally, go to your DigitalOcean control panel and create a droplet base in the newly created image
