async function simulerHeleRunde1() {
    const { data: matches } = await client.from('matches').select('*').eq('round', 1);
    for (const m of matches) {
        const sA = Math.floor(Math.random() * 5) + 3; // 3-7 point
        const sB = Math.floor(Math.random() * 3);     // 0-2 point (så vi altid har en vinder)
        const winnerId = sA > sB ? m.team_a : m.team_b;
        const loserId = sA > sB ? m.team_b : m.team_a;

        await client.from('matches').update({ score_a: sA, score_b: sB, status: 'finished', winner_id: winnerId }).eq('id', m.id);
        await advanceTeams(m.id, winnerId, loserId);
    }
    console.log("✅ Runde 1 simuleret! Alle 8 hold er nu fordelt i de 4 semifinaler.");
}
simulerHeleRunde1();


async function simulerRestenAfTurneringen() {
    console.log("🚀 Starter simulering af Semifinaler og Finaler...");

    // --- RUNDE 2: SEMIFINALER & TABER-SEMI ---
    console.log("--- Spiller Runde 2 ---");
    const { data: round2 } = await client.from('matches').select('*').eq('round', 2);
    
    for (const m of round2) {
        if (!m.team_a || !m.team_b) {
            console.warn(`Kamp ${m.id} mangler hold - springer over.`);
            continue;
        }
        
        const sA = Math.floor(Math.random() * 5) + 3; // 3-7 point
        const sB = Math.floor(Math.random() * 3);     // 0-2 point
        const winnerId = sA > sB ? m.team_a : m.team_b;
        const loserId = sA > sB ? m.team_b : m.team_a;

        await client.from('matches').update({ 
            score_a: sA, score_b: sB, status: 'finished', winner_id: winnerId 
        }).eq('id', m.id);
        
        // Flyt holdene videre til finaler/placeringskampe
        await advanceTeams(m.id, winnerId, loserId);
        console.log(`Kamp ${m.id} færdig: ${sA}-${sB}.`);
    }

    // Vi venter lige et kort øjeblik på at databasen lander, før vi tager finalerne
    await new Promise(r => setTimeout(r, 1000));

    // --- RUNDE 3: FINALE & PLACERINGER ---
    console.log("--- Spiller Runde 3 (Finaler) ---");
    const { data: round3 } = await client.from('matches').select('*').eq('round', 3);
    
    for (const m of round3) {
        if (!m.team_a || !m.team_b) {
            console.warn(`Kamp ${m.id} mangler hold - springer over.`);
            continue;
        }

        const sA = Math.floor(Math.random() * 5) + 3;
        const sB = Math.floor(Math.random() * 3);
        const winnerId = sA > sB ? m.team_a : m.team_b;

        await client.from('matches').update({ 
            score_a: sA, score_b: sB, status: 'finished', winner_id: winnerId 
        }).eq('id', m.id);
        console.log(`Kamp ${m.id} færdig: ${sA}-${sB}.`);
    }

    console.log("✅ Turneringen er slut! Se dit flotte resultat-træ i appen.");
}

// Kør simulatoren
simulerRestenAfTurneringen();