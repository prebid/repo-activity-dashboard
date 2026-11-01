# Font files

Unmodified woff2 files as served by Google Fonts, downloaded 2026-11-01. Each family is licensed under the SIL Open Font License 1.1; its `OFL.txt` is the licence text Google Fonts publishes for it. Mona Sans carries the Reserved Font Name "Mona", so the files are committed as served and are not subset or instanced here.

| File                                  | Family, version                    | Axes                      | Source                                                                                     | sha256                                                             |
| ------------------------------------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `inter/inter-latin.woff2`             | Inter, Version 4.001;git-66647c0bb | wght 100–900              | `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2`   | `c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4` |
| `inter/inter-latin-ext.woff2`         | Inter, Version 4.001;git-66647c0bb | wght 100–900              | `https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7W0Q5n-wU.woff2` | `a28eb6d3ccb534ae0c94ca999371df024aab60b08c3c8a5720ee9e32fa0faaa2` |
| `mona-sans/mona-sans-latin.woff2`     | Mona Sans, Version 2.000           | wdth 75–125, wght 200–900 | `https://fonts.gstatic.com/s/monasans/v4/o-0IIpQmx24alC5A4PNr5TRASf6M7Q.woff2`             | `ee160ac40431983dc9d49e42799769d779ec164419805cae6ac7e3158dfd2ad2` |
| `mona-sans/mona-sans-latin-ext.woff2` | Mona Sans, Version 2.000           | wdth 75–125, wght 200–900 | `https://fonts.gstatic.com/s/monasans/v4/o-0IIpQmx24alC5A4PNr6zRASf6M7VBj.woff2`           | `c712dee2e2cc224ac4d2a715989e2a52bd5dde800ef2576531ae001d48fce21d` |

The latin files cover U+0000–00FF and common punctuation; the latin-ext files hold only the extended Latin ranges and no digits. Both files of a family are loaded as one face family (`src/styles/fonts.ts`), latin last so it takes precedence for the characters both contain.
