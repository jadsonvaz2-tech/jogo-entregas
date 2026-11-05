# Crônicas da Floresta — Aventura Medieval

Protótipo 3D para navegador, com foco em controles Android e futura preparação para Android/Google Play.

## Estrutura

- `index.html` — entrada do jogo.
- `src/main.js` — cena 3D, personagem, câmera, controles e mecânicas.
- `src/style.css` — interface responsiva e HUD.
- `assets/3d/` — modelos glTF, buffers BIN e texturas PNG originais. Os arquivos ficam juntos para preservar os caminhos relativos definidos dentro dos modelos.
- `.github/workflows/pages.yml` — publicação automática no GitHub Pages.
- `.nojekyll` — desativa o processamento Jekyll no Pages.

## Desenvolvimento

O jogo usa Three.js via import map/CDN. Abra o projeto por um servidor HTTP (GitHub Pages, por exemplo); não abra o HTML como arquivo local.

## Controles

- Celular: joystick para andar; arraste a área livre para girar a câmera; botões para correr e coletar.
- Computador: WASD/setas para andar, Shift para correr, E para coletar; arraste com o mouse para girar a câmera.

## Observação

Esta é uma primeira versão jogável/protótipo. Sistemas avançados de sobrevivência, construção, agricultura, aldeia, NPCs, combate, dinastia e empacotamento Android serão desenvolvidos por etapas.
