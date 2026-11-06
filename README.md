# Saad Malik — Portfolio Website

A lightweight, static portfolio website built from the supplied HTML design.

## Run locally on a phone or computer

Open `index.html` in a modern browser. An internet connection is needed for the hosted fonts and Tailwind CDN styling.

## Deploy with Vercel (phone-friendly route)

1. Create a GitHub repository and upload `index.html` to the repository root.
2. Sign in to Vercel and choose **Add New → Project**.
3. Import that GitHub repository.
4. For a plain static HTML site, leave the framework preset as **Other**.
5. Leave the build command and output directory empty, then deploy.
6. Vercel will provide a public URL.

## Contact form behavior

The form validates the required fields and opens the visitor's configured email app with a pre-filled message addressed to `saadiimalik732@gmail.com`. The visitor must press Send in that email app.

This is a static website; it does not yet store or deliver form submissions through a server. To receive submissions without the visitor opening an email app, connect a form backend (for example, a Formspree endpoint) after creating and verifying the account.

## Before public launch

- Test the page on a small phone and a desktop-sized screen.
- Confirm WhatsApp and email links.
- Consider replacing the remote hero image with an optimized locally hosted image.
- For production performance, replace the Tailwind CDN with compiled CSS.
