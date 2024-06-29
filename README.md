# discord-bot
Um bot para o Discord que te notifica de alertas da rede Carris Metropolitana.
Em beta.

Podes convidar o bot para o teu servidor [aqui](https://discord.com/oauth2/authorize?client_id=395958200353947660).
Para usar, escreve "/ajuda" para ver os comandos disponíveis.

Se quiseres correr o próprio bot, recomendamos que use [Docker](https://www.docker.com/).
Copia o ficheiro `.env.example` para `.env` e preenche com as informações necessárias.
```bash
docker build . -t discord-bot
docker run --env-file .env -d discord-bot
```


Se quiseres fazer desenvolvimento, instala [Bun](https://bun.sh/) e segue os passos abaixo.

Para instalar dependências:
```bash
bun install
```

Para correr:
```bash
bun run src/index.ts
```

