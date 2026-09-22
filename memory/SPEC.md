# Banco de Dados de Jogadores — Especificação viva

## O que o app faz
Painel em português para a comissão do Greval gerenciar o elenco. Exibe resumo do elenco, busca e filtros por categoria, posição e status, cards de atletas, ficha técnica completa e cadastro/edição/exclusão persistidos no MongoDB. O banco foi zerado para que a comissão cadastre os atletas manualmente.

## Dados do jogador
Dados pessoais e escolares; foto do atleta; posição, categoria, camisa e status; medidas físicas; saúde e restrições; contrato, número CBF, inscrição BID, data de publicação, início, término e rescisão; clube/UF; dados separados do pai e da mãe (nome, CPF e telefone); atributos de scouting (0–99); observações e histórico completo; documentos PDF separados para RG, CPF e certidão de nascimento. As categorias oficiais são 09, 10, 11, 13, 14, 15, 17, 18, 20 e Profissional.

## Fluxos principais
1. Abrir o painel e visualizar o estado vazio do elenco.
2. Pesquisar/filtrar atletas e abrir a ficha completa.
3. Criar um jogador pelo botão Novo jogador.
4. Editar ou excluir um registro existente.
5. Imprimir a ficha técnica e usar a opção do navegador para salvar em PDF.
6. Anexar, substituir e abrir documentos PDF na ficha do atleta.
7. Adicionar ou trocar a foto do atleta em JPG, PNG ou WEBP.

## Backend
FastAPI em `/api/players`, MongoDB na coleção `players`, IDs string UUID. Não há autenticação nem integrações externas nesta versão.

## Identidade
Tema escuro de operação esportiva com azul royal, amarelo ouro e verde gramado, usando o escudo oficial enviado.

## Estado atual
O formulário de Novo jogador usa largura responsiva ampla no desktop e grids adaptáveis para evitar rótulos quebrados. Não há atletas cadastrados no banco neste momento.
O limite de cada PDF é 10 MB e o da foto é 5 MB; os arquivos são armazenados no backend local e ficam acessíveis na ficha do jogador.
Os campos de CPF aplicam automaticamente o formato `000.000.000-00` e os telefones usam `(00) 00000-0000` durante a digitação.