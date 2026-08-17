/* ==========================================================================
   Padel-Cup Testing & Simulation Utility Helper
   Tilgængelig i browser-konsollen (F12) via PadelTest eller direkte funktioner!
   ========================================================================== */

const TEST_PLAYER_NAMES = [
    "Mikkel", "Sarah", "Kasper", "Jonas", "Mette", "Camilla",
    "Frederik", "Emma", "Christian", "Sofie", "Lasse", "Laura",
    "Mads", "Julie", "Peter", "Katrine", "Henrik", "Louise",
    "Thomas", "Anna", "Rasmus", "Maria", "Simon", "Ida",
    "Martin", "Cecilie", "Alexander", "Helena", "Mathias", "Christina",
    "Oliver", "Emilie", "Victor", "Freja", "Oscar", "Alberte"
];

const PadelTest = {

    /**
     * 1. Rydder ALT data i Supabase databasen (tournaments, teams, matches)
     */
    async clearAllData() {
        console.log("%c🧹 Rydder alle turneringer, hold og kampe fra databasen...", "color: #ef4444; font-weight: bold; font-size: 14px;");
        
        await client.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log("%c✅ Alt data i databasen er slettet!", "color: #10b981; font-weight: bold;");
        if (typeof goToMyTournaments === 'function') goToMyTournaments();
    },

    /**
     * 2. Fyld alle ledige hold med simulerede spillere i en turnering
     */
    async fillTeams(tournamentId = currentTournamentId) {
        if (!tournamentId) {
            console.error("❌ Ingen turnering angivet eller åben!");
            return;
        }

        const { data: t } = await client.from('tournaments').select('*').eq('id', tournamentId).single();
        if (!t) return console.error("❌ Turnering ikke fundet.");

        const { data: teams } = await client.from('teams').select('*').eq('tournament_id', tournamentId).order('team_number');
        if (!teams) return;

        console.log(`%c👥 Fylder hold op med simulerede deltagere for "${t.name}"...`, "color: #3b82f6; font-weight: bold;");

        const isSingle = t.format === 'single';
        let nameIdx = 0;

        for (const team of teams) {
            let p1 = team.player1 || TEST_PLAYER_NAMES[nameIdx++ % TEST_PLAYER_NAMES.length];
            let p2 = null;
            if (!isSingle) {
                p2 = team.player2 || TEST_PLAYER_NAMES[nameIdx++ % TEST_PLAYER_NAMES.length];
            }

            await client.from('teams').update({ player1: p1, player2: p2 }).eq('id', team.id);
        }

        console.log(`%c✅ Alle ${t.max_teams} hold er nu fyldt med spillere!`, "color: #10b981; font-weight: bold;");
        if (typeof fetchTeams === 'function') fetchTeams();
    },

    /**
     * 3. Simulér resultater for alle klar-spillede kampe i den nuværende turnering
     */
    async playCurrentMatches(tournamentId = currentTournamentId) {
        if (!tournamentId) return console.error("❌ Ingen turnering åben!");

        const { data: matches } = await client
            .from('matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .eq('status', 'ready');

        if (!matches || matches.length === 0) {
            console.log("ℹ️ Ingen kampe er klar til afvikling i øjeblikket.");
            return;
        }

        console.log(`%c🎾 Simulerer kampe for ${matches.length} igangværende opgør...`, "color: #3b82f6; font-weight: bold;");

        const scores = [[6, 4], [6, 2], [7, 5], [6, 3], [6, 1], [10, 8]];

        for (const m of matches) {
            if (m.team_a_id && m.team_b_id) {
                const randomScore = scores[Math.floor(Math.random() * scores.length)];
                const isAWinner = Math.random() > 0.5;
                const sA = isAWinner ? randomScore[0] : randomScore[1];
                const sB = isAWinner ? randomScore[1] : randomScore[0];
                const wId = sA > sB ? m.team_a_id : m.team_b_id;
                const lId = sA > sB ? m.team_b_id : m.team_a_id;

                await client.from('matches').update({
                    score_a: sA,
                    score_b: sB,
                    status: 'finished',
                    winner_team_id: wId
                }).eq('id', m.id);

                if (typeof advanceTeams === 'function') {
                    await advanceTeams(tournamentId, m.match_number, wId, lId);
                }
            }
        }

        console.log("%c✅ Kampe spillet og vinderne er rykket videre!", "color: #10b981; font-weight: bold;");
        if (typeof fetchMatches === 'function') fetchMatches();
    },

    /**
     * 4. Fuld end-to-end turnering simulering (Opret -> Fyld hold -> Start -> Spil alle runder)
     */
    async simulateFullTournament(maxTeams = 16, format = "double") {
        console.log(`%c🚀 Starter fuld simulering af en ${maxTeams}-holds ${format} turnering...`, "color: #8b5cf6; font-weight: bold; font-size: 15px;");

        const adminName = currentUser || "TestAdmin";
        const tName = `Simuleret Test Cup (${maxTeams} Hold)`;

        // 1. Opret turnering
        const { data: newT, error } = await client.from('tournaments').insert({
            name: tName,
            admin_username: adminName,
            admin_contact: "test@padel.dk",
            format: format,
            max_teams: maxTeams,
            status: 'registration'
        }).select().single();

        if (error) return console.error("❌ Fejl ved oprettelse:", error);

        // Opret hold-pladser
        const teamsToInsert = [];
        for (let i = 1; i <= maxTeams; i++) {
            teamsToInsert.push({ tournament_id: newT.id, team_number: i });
        }
        await client.from('teams').insert(teamsToInsert);

        // 2. Fyld hold
        await this.fillTeams(newT.id);

        // Åbn turnering
        currentTournamentId = newT.id;
        currentTournament = newT;
        if (typeof openTournament === 'function') await openTournament(newT.id);

        // 3. Start turnering (genererer fuldt placerings-bracket med taber-kampe)
        if (typeof startTournament === 'function') {
            await startTournament(maxTeams);
        }

        // 4. Afvikl runder indtil alle kampe er færdige
        let roundsLimit = 15;
        while (roundsLimit-- > 0) {
            const { data: remainingReady } = await client
                .from('matches')
                .select('*')
                .eq('tournament_id', newT.id)
                .eq('status', 'ready');

            if (!remainingReady || remainingReady.length === 0) break;
            await this.playCurrentMatches(newT.id);
            await new Promise(r => setTimeout(r, 300));
        }

        console.log(`%c🏆 Simulering af "${tName}" er gennemført 100%!`, "color: #10b981; font-weight: bold; font-size: 15px;");
    },

    /**
     * Print hjælpemenu i konsollen
     */
    help() {
        console.log(
            "%c🎾 PADEL-CUP TEST UTILITY HJÆLP 🎾\n\n" +
            "Du kan køre følgende funktioner direkte i konsollen (F12):\n\n" +
            "1. PadelTest.clearAllData()               - Sletter ALT data i Supabase DB\n" +
            "2. PadelTest.fillTeams()                  - Fylder alle hold i den åbne turnering med testspillere\n" +
            "3. PadelTest.playCurrentMatches()         - Spiller alle igangværende kampe med realistiske scores\n" +
            "4. PadelTest.simulateFullTournament(16)   - Opretter, fylder, starter og gennemfører en 16-holds turnering\n" +
            "5. PadelTest.simulateFullTournament(8)    - Samme med 8 hold\n" +
            "6. PadelTest.simulateFullTournament(32)   - Samme med 32 hold\n\n" +
            "Du kan også kalde funktionerne direkte (fx clearAllData(), fillTeams(), simulateFullTournament(16))!",
            "color: #3b82f6; font-size: 12px; line-height: 1.6;"
        );
    }
};

// Global shortcuts i browser window
window.PadelTest = PadelTest;
window.clearAllData = () => PadelTest.clearAllData();
window.fillTeams = (id) => PadelTest.fillTeams(id);
window.playCurrentMatches = (id) => PadelTest.playCurrentMatches(id);
window.simulateFullTournament = (maxTeams, format) => PadelTest.simulateFullTournament(maxTeams, format);

// Log hjælp ved opstart
console.log("%c🎾 Padel-Cup Test-Værktøjer aktiveret! Skriv PadelTest.help() eller simulateFullTournament(16) i konsollen.", "color: #34d399; font-weight: bold; background: #0f172a; padding: 6px 12px; border-radius: 6px;");
