# Tap Palavra

Jogo local de palavras por categorias, feito em HTML, CSS e JavaScript puro. Não usa backend nem banco de dados.

## Como jogar

1. Escolha a quantidade de jogadores.
2. Defina o tempo por turno e quantas cartas são necessárias para vencer.
3. O jogo sorteia uma categoria.
4. Na sua vez, diga uma resposta válida, toque na letra inicial e depois toque no botão central.
5. A letra usada fica bloqueada pelo restante da rodada.
6. Se o tempo acabar, o jogador da vez é eliminado da rodada.
7. O último jogador restante ganha uma carta.
8. Vence a partida quem atingir primeiro a quantidade configurada de cartas.

## Recursos

- 2 a 8 jogadores no mesmo aparelho
- Categorias aleatórias sem repetição até o baralho terminar
- Cronômetro baseado em horário real, resistente a atrasos do `setInterval`
- Eliminação automática
- Pontuação por cartas
- Letras básicas ou modo difícil com K/W/X/Y/Z
- Sons gerados no navegador (sem arquivos de áudio)
- Vibração em celulares compatíveis
- Pausa
- Wake Lock para evitar que a tela apague quando suportado
- Preferências salvas com `localStorage`
- PWA instalável e cache offline
- Pronto para Netlify

## Testar localmente

Como existe um Service Worker, prefira abrir por um servidor HTTP local em vez de clicar diretamente no `index.html`.

Exemplos:

```bash
python3 -m http.server 8080
```

ou

```bash
npx serve .
```

Depois abra `http://localhost:8080`.

## Publicar no Netlify

Você pode arrastar a pasta inteira para o Netlify Drop ou conectar um repositório Git. Não há comando de build e a pasta publicada é a raiz do projeto.
