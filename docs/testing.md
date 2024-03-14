# Testing

The majority of our tests are integration tests powered by Microsoft playwright.

## Running

```
npm test
```

## Linux prereqs

### RHEL / Fedora

On Fedora / RHEL-like systems, the comments here are helpful:

https://github.com/microsoft/playwright/issues/9199

```bash
dnf install -y alsa-lib \
  at-spi2-atk \
  at-spi2-core \
  atk \
  bash \
  cairo \
  cups-libs \
  dbus-libs \
  expat \
  flac-libs \
  gdk-pixbuf2 \
  glib2 \
  glibc \
  gtk3 \
  libX11 \
  libXcomposite \
  libXdamage \
  libXext \
  libXfixes \
  libXrandr \
  libXtst \
  libcanberra-gtk3 \
  libdrm \
  libgcc \
  libstdc++ \
  libxcb \
  libxkbcommon \
  libxshmfence \
  libxslt \
  mesa-libgbm \
  nspr \
  nss \
  nss-util \
  pango \
  policycoreutils \
  policycoreutils-python-utils \
  dbus-glib \
  zlib
```

## Debian / Ubuntu

To get webkit tests passing in Linux, you need to follow the instructions for installing [Microsoft playwright](https://github.com/microsoft/playwright).

The following work on Ubuntu 20.x, with libicui18n.so.66 needing to be manually installed using this deb package: http://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu66_66.1-2ubuntu2_amd64.deb

```bash
# === INSTALL BROWSER DEPENDENCIES ===

# Install WebKit dependencies
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    libwoff1 \
    libopus0 \
    libwebp6 \
    libwebpdemux2 \
    libenchant1c2a \
    libgudev-1.0-0 \
    libsecret-1-0 \
    libhyphen0 \
    libgdk-pixbuf2.0-0 \
    libegl1 \
    libnotify4 \
    libxslt1.1 \
    libevent-2.1-7 \
    libgles2 \
    libxcomposite1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libepoxy0 \
    libgtk-3-0 \
    libharfbuzz-icu0

# Install gstreamer and plugins to support video playback in WebKit.
sudo apt-get install -y --no-install-recommends \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    gstreamer1.0-plugins-good \
    gstreamer1.0-libav

# Install Chromium dependencies
sudo apt-get install -y --no-install-recommends \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-noto-color-emoji \
    libxtst6

# Install Firefox dependencies
sudo apt-get install -y --no-install-recommends \
    libdbus-glib-1-2 \
    libxt6

# Install ffmpeg to bring in audio and video codecs necessary for playing videos in Firefox.
sudo apt-get install -y --no-install-recommends \
    ffmpeg

# (Optional) Install XVFB if there's a need to run browsers in headful mode
sudo apt-get install -y --no-install-recommends \
    xvfb

```
