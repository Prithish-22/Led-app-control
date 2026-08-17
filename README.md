# ⚡ Neon Sync — Smart Web Bluetooth LED Studio

A modern, responsive, zero-install Web Bluetooth controller for generic **ELK-BLEDOM** & **MELK-OA10** RGB and Addressable (RGBIC) LED strips.

![Neon Sync Preview](https://img.shields.io/badge/Web%20Bluetooth-Supported-brightgreen)
![Responsive](https://img.shields.io/badge/Layout-PC%20%26%20Mobile-blue)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## 🌟 Key Features

- **🌐 100% Web-Based**: Control your LED strip directly from Chrome, Edge, Brave, or Opera without installing third-party apps.
- **📱 Dual Optimized Layouts**:
  - **PC / Laptop**: Studio sidebar, 2-column precision dashboard, real-time live preview.
  - **Mobile Phone**: Full-screen native app feel with sticky bottom navigation.
- **🎨 16M Color Precision**: Interactive color wheel, numeric RGB inputs, Master Brightness, and CCT White Temperature slider.
- **✨ 212 Hardware IC Modes**: Categorized into Basic, Curtain, Trans, and Water effects with animation speed control.
- **🎵 Hardware & Software Music Sync**:
  - **8 Chipset Modes**: Internal hardware microphone sync.
  - **8 Web Audio Algorithms**: Low-latency browser microphone reactivity with real-time FFT visualizer.
- **🎬 Custom Sequence Studio**: Build and loop custom color palettes with Instant Jump or Smooth Fade transitions.
- **⏱️ Sleep Timer & Daily Automation**: Set automatic On/Off schedules and 15m/30m/1h/2h sleep timers.

---

## 🚀 How to Host on GitHub Pages (Free & Instant)

Web Bluetooth requires **HTTPS** (or localhost). By enabling GitHub Pages on this repo, you can control your lights from your phone anywhere!

1. Go to your repository **Settings** on GitHub.
2. Click **Pages** (under the "Code and automation" sidebar section).
3. Under **Branch**, select `main` (or `master`) and `/ (root)`.
4. Click **Save**.
5. Your live app will be accessible at: `https://prithish-22.github.io/Led-app-control/`

---

## 📡 Bluetooth Protocol Reference

This controller communicates with BLE GATT service `0000fff0` on characteristic `0000fff3` using standard 9-byte hex packets starting with `0x7E` and terminating with `0xEF`.
