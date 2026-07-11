The Multi-Agent Brain (Opgradering af lib/agents.ts)
Før AI'erne kan undervise, diagnosticere eller generere grafik, skal de kunne tale sammen struktureret. Vi skifter jeres "stubs" ud med en rigtig agent-orkestrator.

Dette skal bygges:

Implementering af et Multi-Agent framework (fx LangGraph.js eller AutoGen) i Next.js backend'en.
De 9 agenter gøres stateful (de får en episodisk hukommelse via pgvector i Supabase).
Prompt til Claude Code (Starten på kontrakten):
"Claude, vi starter Epic 1: Multi-Agent Orchestration. Læs lib/agents.ts. Integrer @langchain/langgraph. Opret en 'Supervisor Agent', der kan route requests mellem Aria (reception), Niels (scribe), og en ny agent: 'Tutor' (E-learning). Sørg for, at deres 'State' og hukommelse gemmes asynkront i vores Supabase events og journal_entries tabeller. Skriv Adversarial Tests, der sikrer, at agenterne ikke hallucinerer hinandens data."