# Crônicas da Floresta — Aventura Medieval

Protótipo 3D para navegador, com foco em controles Android e futura preparação para Android/Google Play.

## Estrutura do projeto

- `index.html` — entrada do jogo.
- `src/main.js` — cena 3D, personagem, câmera, controles e mecânicas.
- `src/style.css` — interface responsiva e HUD.
- `assets/3d/` — biblioteca 3D principal: modelos glTF, buffers BIN e texturas PNG que já eram usados pelo jogo.
- `assets/3d/animals/` — modelos adicionais de animais importados e usados pelos carregadores de fauna.
- `assets/3d/imported-root-copies/` — cópias e versões paralelas importadas na raiz (150 arquivos idênticos aos da biblioteca e uma variante de modelo), preservadas sem interferir nos arquivos ativos.
- `.github/workflows/pages.yml` — valida sintaxe JavaScript e dependências dos modelos 3D.
- `.nojekyll` — desativa o processamento Jekyll no Pages.

Os arquivos glTF que possuem buffers ou texturas externos devem permanecer junto dos respectivos recursos relativos. Por isso, os modelos da biblioteca original não foram separados individualmente.

## Modelos adicionais disponíveis

A pasta `assets/3d/animals/` contém alpaca, touro, veado, burro, raposa, dois cavalos, husky, shiba inu, cervo e lobo. Raposa, cervo e lobo já são referenciados pelo sistema de fauna. Os demais estão organizados e prontos para integração gradual em sistemas de montaria, animais domésticos e criação.

## Desenvolvimento

O jogo usa Three.js via import map/CDN. Abra o projeto por um servidor HTTP (GitHub Pages, por exemplo); não abra o HTML como arquivo local.

## Controles

- Celular: joystick para andar; arraste a área livre para girar a câmera; botões para correr e coletar.
- Computador: WASD/setas para andar, Shift para correr, E para coletar; arraste com o mouse para girar a câmera.

## Observação

Esta é uma primeira versão jogável/protótipo. Sistemas avançados de sobrevivência, construção, agricultura, aldeia, NPCs, combate, dinastia e empacotamento Android serão desenvolvidos por etapas.
