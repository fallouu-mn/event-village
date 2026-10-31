# Archive — synthèses générées par IA (août–septembre 2026)

Ces six documents ont été produits par l'outil de génération qui a écrit la première version du code (DIAGNOSTIC, FIX_SUMMARY, IMPROVEMENTS_SUMMARY, IMPLEMENTATION_SUMMARY, TEST_SUMMARY, agent-production-audit-final).

**Ils sont contredits par l'audit du 30 octobre 2026** (`docs/audit-evenementiel-cdc-v3.md` et `docs/audit-evenementiel-annexe-constats.md`). En particulier :

- les affirmations « 100 % pass » reposent sur des tests qui ciblent une base Supabase réelle avec des identifiants codés en dur et dont beaucoup ne peuvent pas échouer ;
- les mentions de « blindage » (hold cart, webhook, TOTP, remboursements) décrivent des mécanismes qui comportent des failles exploitables, documentées constat par constat dans l'annexe ;
- plusieurs fonctionnalités annoncées comme terminées ne sont pas câblées dans l'interface (annulation d'événement, pages caisse/équipe par événement).

Ils sont conservés uniquement comme trace historique et ne doivent pas servir de référence.
