# cmet-discord-bot
Um bot para o Discord que te notifica de alertas da rede Carris Metropolitana.
Em beta.

Pode convidar o bot para o seu servidor [aqui](https://discord.com/oauth2/authorize?client_id=395958200353947660).

Se quiser correr o próprio bot, recomendo que use o [Docker](https://www.docker.com/).
Copie o ficheiro `.env.example` para `.env` e preencha com as informações necessárias.
```bash
docker build . -t cmet-discord
docker run --env-file .env -d cmet-discord
```


Se quiser fazer desenvolvimento, instale [Bun](https://bun.sh/) e siga os passos abaixo.

Para instalar dependencias:
```bash
bun install
```

Para correr:
```bash
bun run src/index.ts
```

