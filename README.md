# saBORR futebol — controle financeiro do racha

Aplicação para controlar quem jogou, quanto cada jogo custou e quanto cada atleta ainda deve.

- **Front-end:** Vue 3 + Quasar (Vite), em `web/`
- **API:** Node.js puro (`node:http`, sem dependências), em `server/`
- **Dados:** um único arquivo JSON, `server/data/db.json` (já populado com a planilha *Sabor futebol.xlsx*: 41 atletas e 19 jogos)

## Como rodar

Requer Node 20 ou superior.

```bash
cp .env.example .env        # defina ADMIN_PASSWORD e JWT_SECRET
npm install                 # instala só o front (a API não tem dependências)
npm run dev                 # API em :3000 + front em http://localhost:5173
```

Para uso "de verdade" (um processo só, a API serve o front):

```bash
npm run build               # gera web/dist
npm start                   # http://localhost:3000
```

Testes da API: `npm test`.

## Quem pode o quê

| Perfil | Como entra | O que pode |
| --- | --- | --- |
| **Visitante / atleta** | Sem login — abra o app em `/atletas` | Ver a lista de atletas, saldos e extrato de cada um (mesma tela que o admin usa, sem botões de edição) |
| **Administrador** (você) | Senha definida em `ADMIN_PASSWORD` | Criar, editar e excluir atletas e jogos; marcar/reabrir pagamentos; ver tudo |

Toda regra de permissão é aplicada **na API**, não só nas telas: alterações exigem token de administrador; a consulta de atletas é pública.

## Como o saldo é calculado

Nada de saldo fica gravado: ele é sempre calculado a partir de **quem jogou** e **quem pagou** em cada jogo.

- Valor por pessoa de um jogo = valor total ÷ número de participantes (ex.: R$ 100 ÷ 12 = R$ 8,33).
- Saldo do atleta = soma do que ele deve nos jogos em que participou e ainda não pagou.
- A composição do saldo (quais jogos estão pendentes) aparece no detalhe de cada atleta, para todos que abrem o app.
- Editar ou excluir um jogo/atleta recalcula tudo automaticamente.
- Os cálculos usam o valor exato (sem arredondar a cada jogo) e arredondam só na exibição, como a planilha fazia. Por isso a soma de linhas exibidas pode diferir em 1 centavo do total mostrado.

## Estrutura do `db.json`

```json
{
  "grupo": { "nome": "saBORR futebol", "chavePix": "..." },
  "atletas": [{ "id": "...", "nome": "...", "codigo": "ABC234", "observacoes": "" }],
  "eventos": [{
    "id": "...", "data": "2026-09-16", "valorTotal": 100,
    "participantes": ["<id do atleta>", "..."],
    "pagamentos": ["<ids de quem já pagou>"]
  }]
}
```

A API grava o arquivo a cada alteração (escrita atômica) e guarda uma cópia por dia em `server/data/backups/` (últimos 30 dias). Em **Ajustes** (engrenagem) você também baixa um backup completo.

## Publicando

- Use **HTTPS** (a senha de admin trafega na requisição de login). Plataformas como Render, Railway e Fly já fornecem; nelas defina `TRUST_PROXY=true`.
- Como os dados ficam em arquivo, o servidor precisa de **disco persistente** (volume). Em hospedagens com disco temporário o `db.json` seria perdido a cada deploy.
- O `db.json` contém nomes e saldos calculáveis — trate o repositório e o servidor como privados se preferir não expor o racha publicamente.
- A senha de administrador não fica no JSON: vem do `.env`. Para trocá-la, altere o `.env` e reinicie.

## Reimportando a planilha

`tools/importar_planilha.py` recria o `db.json` a partir do `.xlsx` (**sobrescreve** os dados atuais e gera novos códigos):

```bash
pip install openpyxl
python3 tools/importar_planilha.py "Sabor futebol.xlsx" server/data/db.json
```

As colunas de total da planilha não são importadas; o app recalcula tudo a partir de "Jogou?" e "Pagou?".
