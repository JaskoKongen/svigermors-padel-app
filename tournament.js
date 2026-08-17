let activeMatchId = null;

async function startTournament(overrideTeamsCount) {
    if (!currentTournamentId) return;

    // Hent alle hold med deltagere
    const { data: teams } = await client
        .from('teams')
        .select('*')
        .eq('tournament_id', currentTournamentId)
        .or('player1.neq.null,player2.neq.null');

    const count = teams ? teams.length : 0;
    const targetTeams = overrideTeamsCount || count;

    if (count < 2) {
        return showCustomAlert("Der skal være mindst 2 hold tilmeldt for at starte turneringen.", "For få hold", "⚠️");
    }

    const confirmed = await showCustomConfirm(`Vil du starte turneringen nu med de ${targetTeams} tilmeldte hold?`, "Start Turnering 🚀", "🎾");
    if (!confirmed) return;

    let effectiveMaxTeams = currentTournament.max_teams;

    if (targetTeams <= 4 && currentTournament.max_teams > 4) {
        effectiveMaxTeams = 4;
    } else if (targetTeams <= 8 && currentTournament.max_teams > 8) {
        effectiveMaxTeams = 8;
    } else if (targetTeams <= 16 && currentTournament.max_teams > 16) {
        effectiveMaxTeams = 16;
    }

    if (effectiveMaxTeams !== currentTournament.max_teams) {
        await client.from('tournaments').update({ max_teams: effectiveMaxTeams }).eq('id', currentTournamentId);
        currentTournament.max_teams = effectiveMaxTeams;
    }

    // Tjek om turneringen er en gentaget/seedet udgave (fx indeholder #2, #3 i navnet)
    const isRepeated = /[\(\#](Ny|v?\d+)[\)]?/i.test(currentTournament.name || '');

    let sortedTeams = [];
    if (isRepeated) {
        // Gentaget turnering: Seedet lodtrækning baseret på forrige placeringsstigning (Hold 1 = Seed 1 osv.)
        sortedTeams = [...teams].sort((a, b) => a.team_number - b.team_number);
    } else {
        // Helt ny turnering: 100% Tilfældig lodtrækning blandt holdene!
        sortedTeams = [...teams].sort(() => Math.random() - 0.5);
    }

    const matchesToCreate = [];

    if (effectiveMaxTeams === 4) {
        // Seed 1 vs Seed 4, Seed 2 vs Seed 3
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 1, round: 1, match_type: "🚀 Semifinale 1", team_a_id: sortedTeams[0]?.id || null, team_b_id: sortedTeams[3]?.id || null, status: 'ready' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 2, round: 1, match_type: "🚀 Semifinale 2", team_a_id: sortedTeams[1]?.id || null, team_b_id: sortedTeams[2]?.id || null, status: 'ready' });

        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 3, round: 2, match_type: "🏆 FINALE", team_a_id: null, team_b_id: null, status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 4, round: 2, match_type: "🥉 3./4. PLADS", team_a_id: null, team_b_id: null, status: 'waiting' });
    } else {
        // Seedet parring i Runde 1 (Seed 1 vs Seed Max, Seed 2 vs Seed (Max-1) osv.)
        let r1Pairs = [];
        if (effectiveMaxTeams === 8) {
            r1Pairs = [
                [sortedTeams[0], sortedTeams[7]], // Seed 1 vs 8
                [sortedTeams[3], sortedTeams[4]], // Seed 4 vs 5
                [sortedTeams[2], sortedTeams[5]], // Seed 3 vs 6
                [sortedTeams[1], sortedTeams[6]]  // Seed 2 vs 7
            ];
        } else if (effectiveMaxTeams === 16) {
            r1Pairs = [
                [sortedTeams[0], sortedTeams[15]], // Seed 1 vs 16
                [sortedTeams[7], sortedTeams[8]],  // Seed 8 vs 9
                [sortedTeams[4], sortedTeams[11]], // Seed 5 vs 12
                [sortedTeams[3], sortedTeams[12]], // Seed 4 vs 13
                [sortedTeams[2], sortedTeams[13]], // Seed 3 vs 14
                [sortedTeams[5], sortedTeams[10]], // Seed 6 vs 11
                [sortedTeams[6], sortedTeams[9]],  // Seed 7 vs 10
                [sortedTeams[1], sortedTeams[14]]  // Seed 2 vs 15
            ];
        } else {
            for (let i = 0; i < effectiveMaxTeams / 2; i++) {
                r1Pairs.push([sortedTeams[i * 2], sortedTeams[i * 2 + 1]]);
            }
        }

        for (let i = 0; i < r1Pairs.length; i++) {
            matchesToCreate.push({
                tournament_id: currentTournamentId,
                match_number: i + 1,
                round: 1,
                match_type: `🎾 Indledende Kamp ${i + 1}`,
                team_a_id: r1Pairs[i][0]?.id || null,
                team_b_id: r1Pairs[i][1]?.id || null,
                status: 'ready'
            });
        }

        if (effectiveMaxTeams === 8) {
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 5, round: 2, match_type: "🚀 Semifinale 1", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 6, round: 2, match_type: "🚀 Semifinale 2", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 7, round: 2, match_type: "🔄 Taber-semi 1", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 8, round: 2, match_type: "🔄 Taber-semi 2", status: 'waiting' });

            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 9, round: 3, match_type: "🏆 FINALE (1./2. Plads)", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 10, round: 3, match_type: "🥉 3./4. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 11, round: 3, match_type: "🏅 5./6. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 12, round: 3, match_type: "🎖️ 7./8. PLADS", status: 'waiting' });
        } else if (effectiveMaxTeams === 16) {
            // 16 Hold (4 runder - 32 kampe totalt, alle hold får 4 kampe)
            // Runde 2: 9..12 Kvart, 13..16 Taber-kvart
            for (let i = 1; i <= 4; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 8 + i, round: 2, match_type: `🔥 Kvartfinale ${i}`, status: 'waiting' });
            for (let i = 1; i <= 4; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 12 + i, round: 2, match_type: `🔄 Taber-kvart ${i}`, status: 'waiting' });

            // Runde 3: 17..24 Semifinaler (A, B, C, D grene)
            for (let i = 1; i <= 2; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 16 + i, round: 3, match_type: `🚀 A-Semifinale ${i}`, status: 'waiting' });
            for (let i = 1; i <= 2; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 18 + i, round: 3, match_type: `🔄 B-Semifinale ${i}`, status: 'waiting' });
            for (let i = 1; i <= 2; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 20 + i, round: 3, match_type: `🚀 C-Semifinale ${i}`, status: 'waiting' });
            for (let i = 1; i <= 2; i++) matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 22 + i, round: 3, match_type: `🔄 D-Semifinale ${i}`, status: 'waiting' });

            // Runde 4: 25..32 Placement matches (1-16 plads for ALLE 16 hold)
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 25, round: 4, match_type: "🏆 FINALE (1./2. Plads)", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 26, round: 4, match_type: "🥉 3./4. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 27, round: 4, match_type: "🏅 5./6. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 28, round: 4, match_type: "🎖️ 7./8. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 29, round: 4, match_type: "🏅 9./10. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 30, round: 4, match_type: "🎖️ 11./12. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 31, round: 4, match_type: "🏅 13./14. PLADS", status: 'waiting' });
            matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 32, round: 4, match_type: "🎖️ 15./16. PLADS", status: 'waiting' });
        }
    }

    await client.from('matches').insert(matchesToCreate);
    await client.from('tournaments').update({ status: 'matches' }).eq('id', currentTournamentId);
    currentTournament.status = 'matches';

    if (typeof updateNavVisibility === 'function') updateNavVisibility();
    switchTab('matches');
    fetchMatches();
}

async function fetchMatches() {
    if (!currentTournamentId) return;

    const { data: matches, error } = await client
        .from('matches')
        .select('*, team_a:teams!team_a_id(id, team_number, player1, player2), team_b:teams!team_b_id(id, team_number, player1, player2)')
        .eq('tournament_id', currentTournamentId)
        .order('match_number', { ascending: true });

    if (error) return console.error("Fetch matches error:", error);

    const listDiv = document.getElementById('matches-list');
    if (!listDiv) return;

    if (!matches || matches.length === 0) {
        if (currentTournament && currentTournament.status === 'matches') {
            setTimeout(fetchMatches, 600);
        }
        listDiv.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">Opretter og henter kampprogram...</p>';
        return;
    }

    listDiv.innerHTML = '';

    const finishedCount = matches.filter(m => m.status === 'finished').length;
    const adminFinishedDiv = document.getElementById('tournament-admin-finished');
    if (adminFinishedDiv) {
        if (finishedCount === matches.length && matches.length > 0) {
            const isAdmin = currentTournament && currentTournament.admin_username && currentTournament.admin_username.toLowerCase() === (currentUser || '').toLowerCase();
            
            // Tjek om status allerede er 'finished' for at undgå uendelig Realtime-løkke
            if (currentTournament && currentTournament.status !== 'finished') {
                currentTournament.status = 'finished';
                await client.from('tournaments').update({ status: 'finished' }).eq('id', currentTournamentId);
            }

            adminFinishedDiv.innerHTML = `
                <div class="card" style="text-align:center; background: linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(59,130,246,0.15) 100%); border: 1px solid rgba(16,185,129,0.3);">
                    <h3 style="color:var(--text-main); margin-top:0; font-size:17px;">🏁 Turneringen er færdigspillet!</h3>
                    <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">Alle kampe er afviklet. Se vinderen i stillingstabellen!</p>
                    ${isAdmin ? `<button class="btn-primary" onclick="restartTournament()" style="padding:14px; font-size:14px; width:100%;">🔄 Start Næste Turnering (Seedet efter forrige stilling 🏆)</button>` : ''}
                </div>`;
        } else {
            adminFinishedDiv.innerHTML = '';
        }
    }

    const isSingle = currentTournament?.format === 'single';

    // Grupper efter runder
    const rounds = {};
    matches.forEach(m => {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
    });

    const maxT = currentTournament?.max_teams || 8;
    const roundTitles = {
        1: maxT === 4 ? "Runde 1 (Semifinaler)" : "Runde 1 (Indledende)",
        2: maxT === 4 ? "Runde 2 (Finaler & Placeringer)" : (maxT === 8 ? "Runde 2 (Semifinaler)" : "Runde 2 (Kvartfinaler & Taber-Kvart)"),
        3: maxT === 8 ? "Runde 3 (Finaler & Placeringer)" : "Runde 3 (Semifinaler)",
        4: "Runde 4 (Finaler & Placeringer 1.-16. plads)"
    };

    for (const [roundNum, roundMatches] of Object.entries(rounds)) {
        const roundHeader = document.createElement('div');
        roundHeader.innerHTML = `<h3 style="margin: 24px 0 10px 0; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border-card); padding-bottom: 6px;">${roundTitles[roundNum] || 'Runde ' + roundNum}</h3>`;
        listDiv.appendChild(roundHeader);

        roundMatches.forEach(match => {
            const teamA = match.team_a;
            const teamB = match.team_b;

            const isPlayerIn = (p) => p && p.toLowerCase() === (currentUser || '').toLowerCase();
            const isMyMatch = (teamA && (isPlayerIn(teamA.player1) || isPlayerIn(teamA.player2))) ||
                              (teamB && (isPlayerIn(teamB.player1) || isPlayerIn(teamB.player2)));

            // Tjek om der findes afviklede kampe i en senere runde (større rundenummer)
            const isLaterRoundPlayed = matches.some(m => Number(m.round) > Number(match.round) && m.status === 'finished');

            // Kampen kan kun redigeres hvis det er spillerens egen kamp og senere runder IKKE er spillet
            const canEdit = isMyMatch && teamA && teamB && !isLaterRoundPlayed;

            const card = document.createElement('div');
            card.className = isMyMatch ? 'card my-match' : 'card';
            card.style.marginBottom = '10px';
            card.style.padding = '16px';

            if (canEdit) {
                card.onclick = () => openScoreModal(match);
                card.classList.add('card-interactive');
            } else {
                card.style.cursor = isMyMatch && isLaterRoundPlayed ? 'pointer' : 'default';
                card.style.opacity = !isMyMatch || isLaterRoundPlayed ? '0.85' : '1';

                if (isMyMatch && isLaterRoundPlayed) {
                    card.onclick = () => showCustomAlert("Denne kamp er låst for redigering, fordi der allerede er indtastet resultater i senere runder.", "Kampen er Låst 🔒", "🔒");
                }
            }

            const formatPlayerNames = (t) => {
                if (!t) return 'TBD';
                if (isSingle) return t.player1 || `Hold ${t.team_number}`;
                return `${t.player1 || '?'}${t.player2 ? ' & ' + t.player2 : ''}`;
            };

            const labelA = formatPlayerNames(teamA);
            const labelB = formatPlayerNames(teamB);

            const scoreDisplay = match.status === 'finished' 
                ? `${match.score_a} - ${match.score_b}`
                : (canEdit ? 'Indtast score ✎' : 'Venter');

            let badgeHtml = '';
            if (isMyMatch && isLaterRoundPlayed) {
                badgeHtml = '<span style="font-size:11px; color:var(--text-muted); font-weight:700;">LÅST 🔒</span>';
            } else if (canEdit && match.status !== 'finished') {
                badgeHtml = '<span style="font-size:11px; color:var(--accent-green-bright); font-weight:700;">DIN KAMP ✎</span>';
            } else if (canEdit && match.status === 'finished') {
                badgeHtml = '<span style="font-size:11px; color:var(--accent-blue); font-weight:700;">DIN KAMP ✎</span>';
            }

            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--accent-blue); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap;">
                            ${match.match_type || 'Kamp ' + match.match_number}
                        </span>
                        ${badgeHtml}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px;">
                            <div style="font-weight:700; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${match.status === 'finished' && match.score_a > match.score_b ? 'color:var(--accent-green-bright)' : ''}">
                                ${labelA}
                            </div>
                            <div style="font-weight:700; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${match.status === 'finished' && match.score_b > match.score_a ? 'color:var(--accent-green-bright)' : ''}">
                                ${labelB}
                            </div>
                        </div>
                        <div class="score-display" style="${match.status !== 'finished' ? 'font-size:13px; font-weight:600; padding:6px 12px;' : ''}">
                            ${scoreDisplay}
                        </div>
                    </div>
                </div>`;
            listDiv.appendChild(card);
        });
    }

    calculateLeaderboard(matches);
}

async function calculateLeaderboard(matches) {
    if (!currentTournamentId) return;
    const { data: teams } = await client.from('teams').select('*').eq('tournament_id', currentTournamentId);
    if (!teams) return;

    const isSingle = currentTournament?.format === 'single';
    let stats = {};

    teams.forEach(t => {
        const name = isSingle ? (t.player1 || `Hold ${t.team_number}`) : `Hold ${t.team_number} (${(t.player1 || '') + (t.player2 ? '/' + t.player2 : '')})`;
        stats[t.id] = { id: t.id, name: name, gamesWon: 0, finalRank: 99 };
    });

    matches.forEach(m => {
        if (m.team_a_id && m.team_b_id && m.status === 'finished') {
            if (stats[m.team_a_id]) stats[m.team_a_id].gamesWon += Number(m.score_a);
            if (stats[m.team_b_id]) stats[m.team_b_id].gamesWon += Number(m.score_b);
        }
    });

    // Bestem placeringsrang ud fra finalerne
    const maxT = currentTournament?.max_teams || 8;
    let finalRanks = {};

    if (maxT === 4) {
        finalRanks = { 3: [1, 2], 4: [3, 4] };
    } else if (maxT === 8) {
        finalRanks = { 9: [1, 2], 10: [3, 4], 11: [5, 6], 12: [7, 8] };
    } else if (maxT === 16) {
        finalRanks = { 
            25: [1, 2], 26: [3, 4], 27: [5, 6], 28: [7, 8],
            29: [9, 10], 30: [11, 12], 31: [13, 14], 32: [15, 16]
        };
    } else if (maxT === 32) {
        for (let i = 0; i < 16; i++) {
            finalRanks[65 + i] = [i * 2 + 1, i * 2 + 2];
        }
    }

    Object.entries(finalRanks).forEach(([mNum, ranks]) => {
        const m = matches.find(x => x.match_number == mNum);
        if (m && m.status === 'finished' && m.winner_team_id && m.team_a_id && m.team_b_id) {
            const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
            if (stats[m.winner_team_id]) stats[m.winner_team_id].finalRank = ranks[0];
            if (stats[loserId]) stats[loserId].finalRank = ranks[1];
        }
    });

    let lb = Object.values(stats).sort((a, b) => {
        if (a.finalRank !== b.finalRank) return a.finalRank - b.finalRank;
        return b.gamesWon - a.gamesWon;
    });

    const tbody = document.getElementById('leaderboard-body');
    if (tbody) {
        tbody.innerHTML = '';
        lb.forEach((t, i) => {
            const r = t.finalRank === 99 ? (i + 1) : t.finalRank;
            const rankClass = r === 1 ? 'rank-1' : (r === 2 ? 'rank-2' : (r === 3 ? 'rank-3' : ''));
            tbody.innerHTML += `
                <tr>
                    <td class="rank ${rankClass}">#${r}</td>
                    <td><strong>${t.name}</strong></td>
                    <td class="games-count">${t.gamesWon}</td>
                </tr>`;
        });
    }
}

function openScoreModal(match) {
    activeMatchId = match.id;
    const isSingle = currentTournament?.format === 'single';

    const nameA = match.team_a ? (isSingle ? match.team_a.player1 : `HOLD ${match.team_a.team_number}`) : 'TBD';
    const nameB = match.team_b ? (isSingle ? match.team_b.player1 : `HOLD ${match.team_b.team_number}`) : 'TBD';

    document.getElementById('team-a-label').innerText = nameA;
    document.getElementById('team-b-label').innerText = nameB;
    document.getElementById('score-a').value = match.score_a || 0;
    document.getElementById('score-b').value = match.score_b || 0;
    document.getElementById('score-modal').style.display = 'flex';
}

async function saveScore() {
    const rawA = document.getElementById('score-a').value;
    const rawB = document.getElementById('score-b').value;

    const sA = parseInt(rawA);
    const sB = parseInt(rawB);

    if (isNaN(sA) || isNaN(sB) || sA < 0 || sB < 0) {
        return showCustomAlert("Ugyldigt resultat! Resultater kan ikke være negative eller tomme.", "Ugyldig score ⚠️", "⚠️");
    }

    if (sA === sB) return showCustomAlert("Der skal findes en vinder! Uafgjorte resultater er ikke tilladt i knald-eller-fald kampe.", "Vinder påkrævet 🎾", "🎾");

    const { data: m } = await client.from('matches').select('*').eq('id', activeMatchId).single();
    const wId = sA > sB ? m.team_a_id : m.team_b_id;
    const lId = sA > sB ? m.team_b_id : m.team_a_id;

    await client.from('matches').update({
        score_a: sA,
        score_b: sB,
        status: 'finished',
        winner_team_id: wId
    }).eq('id', activeMatchId);

    await advanceTeams(m.tournament_id, m.match_number, wId, lId);
    closeModal('score-modal');
    fetchMatches();
}

async function setMatchTeamSlot(tId, matchNum, slot, teamId) {
    let updateObj = {};
    updateObj[slot] = teamId;

    const { data: targetMatch } = await client
        .from('matches')
        .select('*')
        .eq('tournament_id', tId)
        .eq('match_number', matchNum)
        .single();

    if (targetMatch) {
        const otherSlot = slot === 'team_a_id' ? 'team_b_id' : 'team_a_id';
        if (targetMatch[otherSlot]) {
            updateObj.status = 'ready';
        }
    }

    await client.from('matches').update(updateObj).eq('tournament_id', tId).eq('match_number', matchNum);
}

async function advanceTeams(tId, matchNum, winnerId, loserId) {
    const maxTeams = currentTournament?.max_teams || 8;

    if (maxTeams === 4) {
        const p4 = {
            1: { w: [3, 'team_a_id'], l: [4, 'team_a_id'] },
            2: { w: [3, 'team_b_id'], l: [4, 'team_b_id'] }
        };
        const n = p4[matchNum];
        if (n) {
            await setMatchTeamSlot(tId, n.w[0], n.w[1], winnerId);
            await setMatchTeamSlot(tId, n.l[0], n.l[1], loserId);
        }
    } else if (maxTeams === 8) {
        // 8 Hold
        const { data: r1Matches } = await client.from('matches').select('*').eq('tournament_id', tId).eq('round', 1);
        const finishedR1 = r1Matches ? r1Matches.filter(m => m.status === 'finished') : [];

        if (finishedR1.length === 4) {
            const { data: semi1 } = await client.from('matches').select('*').eq('tournament_id', tId).eq('match_number', 5).single();
            if (semi1 && !semi1.team_a_id) {
                const winners = finishedR1.map(m => m.winner_team_id);
                const losers = finishedR1.map(m => (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id));

                const sw = [...winners].sort(() => Math.random() - 0.5);
                const sl = [...losers].sort(() => Math.random() - 0.5);

                await client.from('matches').update({ team_a_id: sw[0], team_b_id: sw[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 5);
                await client.from('matches').update({ team_a_id: sw[2], team_b_id: sw[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 6);
                await client.from('matches').update({ team_a_id: sl[0], team_b_id: sl[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 7);
                await client.from('matches').update({ team_a_id: sl[2], team_b_id: sl[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 8);
            }
        }

        if (matchNum >= 5 && matchNum <= 8) {
            const finalMap = {
                5: { w: [9, 'team_a_id'], l: [10, 'team_a_id'] },
                6: { w: [9, 'team_b_id'], l: [10, 'team_b_id'] },
                7: { w: [11, 'team_a_id'], l: [12, 'team_a_id'] },
                8: { w: [11, 'team_b_id'], l: [12, 'team_b_id'] }
            };
            const fn = finalMap[matchNum];
            if (fn) {
                await setMatchTeamSlot(tId, fn.w[0], fn.w[1], winnerId);
                await setMatchTeamSlot(tId, fn.l[0], fn.l[1], loserId);
            }
        }
    } else if (maxTeams === 16) {
        // 16 Hold (4 Runder)
        const { data: r1Matches } = await client.from('matches').select('*').eq('tournament_id', tId).eq('round', 1);
        const finishedR1 = r1Matches ? r1Matches.filter(m => m.status === 'finished') : [];

        if (finishedR1.length === 8) {
            const { data: q1 } = await client.from('matches').select('*').eq('tournament_id', tId).eq('match_number', 9).single();
            if (q1 && !q1.team_a_id) {
                const winners = finishedR1.map(m => m.winner_team_id);
                const losers = finishedR1.map(m => (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id));

                const sw = [...winners].sort(() => Math.random() - 0.5);
                const sl = [...losers].sort(() => Math.random() - 0.5);

                // Vind-Kvartfinaler (Kamp 9..12)
                await client.from('matches').update({ team_a_id: sw[0], team_b_id: sw[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 9);
                await client.from('matches').update({ team_a_id: sw[2], team_b_id: sw[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 10);
                await client.from('matches').update({ team_a_id: sw[4], team_b_id: sw[5], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 11);
                await client.from('matches').update({ team_a_id: sw[6], team_b_id: sw[7], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 12);

                // Taber-Kvartfinaler (Kamp 13..16)
                await client.from('matches').update({ team_a_id: sl[0], team_b_id: sl[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 13);
                await client.from('matches').update({ team_a_id: sl[2], team_b_id: sl[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 14);
                await client.from('matches').update({ team_a_id: sl[4], team_b_id: sl[5], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 15);
                await client.from('matches').update({ team_a_id: sl[6], team_b_id: sl[7], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 16);
            }
        }

        // Runde 2 til Runde 3 (Kvartfinaler til Semifinaler)
        if (matchNum >= 9 && matchNum <= 16) {
            const p16_r2 = {
                9:  { w: [17, 'team_a_id'], l: [19, 'team_a_id'] },
                10: { w: [17, 'team_b_id'], l: [19, 'team_b_id'] },
                11: { w: [18, 'team_a_id'], l: [20, 'team_a_id'] },
                12: { w: [18, 'team_b_id'], l: [20, 'team_b_id'] },
                13: { w: [21, 'team_a_id'], l: [23, 'team_a_id'] },
                14: { w: [21, 'team_b_id'], l: [23, 'team_b_id'] },
                15: { w: [22, 'team_a_id'], l: [24, 'team_a_id'] },
                16: { w: [22, 'team_b_id'], l: [24, 'team_b_id'] }
            };
            const fn = p16_r2[matchNum];
            if (fn) {
                await setMatchTeamSlot(tId, fn.w[0], fn.w[1], winnerId);
                await setMatchTeamSlot(tId, fn.l[0], fn.l[1], loserId);
            }
        }

        // Runde 3 til Runde 4 (Semifinaler til Finaler og placeringer 1-16)
        if (matchNum >= 17 && matchNum <= 24) {
            const p16_r3 = {
                17: { w: [25, 'team_a_id'], l: [26, 'team_a_id'] },
                18: { w: [25, 'team_b_id'], l: [26, 'team_b_id'] },
                19: { w: [27, 'team_a_id'], l: [28, 'team_a_id'] },
                20: { w: [27, 'team_b_id'], l: [28, 'team_b_id'] },
                21: { w: [29, 'team_a_id'], l: [30, 'team_a_id'] },
                22: { w: [29, 'team_b_id'], l: [30, 'team_b_id'] },
                23: { w: [31, 'team_a_id'], l: [32, 'team_a_id'] },
                24: { w: [31, 'team_b_id'], l: [32, 'team_b_id'] }
            };
            const fn = p16_r3[matchNum];
            if (fn) {
                await setMatchTeamSlot(tId, fn.w[0], fn.w[1], winnerId);
                await setMatchTeamSlot(tId, fn.l[0], fn.l[1], loserId);
            }
        }
    }
}

async function restartTournament() {
    if (!currentTournament) return;
    const isAdmin = currentTournament.admin_username && currentTournament.admin_username.toLowerCase() === (currentUser || '').toLowerCase();
    if (!isAdmin) return showCustomAlert("Kun Admin kan genoprette turneringen.", "Adgang nægtet", "🔒");

    // 1. Find det rene grundnavn uden gamle numre eller (Ny)
    let baseName = currentTournament.name.replace(/\s*[\(\#](Ny|v?\d+)[\)]?/gi, '').trim();

    // Find det næste ledige udgavenummer (#2, #3, #4...)
    const { data: existing } = await client.from('tournaments').select('name');
    let nextNum = 2;
    if (existing) {
        const existingNames = existing.map(t => t.name.toLowerCase());
        while (existingNames.includes(`${baseName} #${nextNum}`.toLowerCase())) {
            nextNum++;
        }
    }

    const newName = `${baseName} #${nextNum}`;

    const confirmed = await showCustomConfirm(
        `Vil du oprette næste turnering "${newName}" med de samme hold?\n\nHoldene vil automatisk blive SEEDET (1. plads mod 8. plads, 2. plads mod 7. plads osv.) baseret på deres placering i denne turnering! 🏆`,
        "Start Næste Turnering (Seedet) 🏆",
        "🎾"
    );
    if (!confirmed) return;

    // 2. Hent gamle kampe og hold for at beregne placeringsrang til seeding
    const { data: prevMatches } = await client.from('matches').select('*').eq('tournament_id', currentTournamentId);
    const { data: oldTeams } = await client.from('teams').select('*').eq('tournament_id', currentTournamentId);

    let stats = {};
    if (oldTeams) {
        oldTeams.forEach(t => {
            stats[t.id] = { id: t.id, team_number: t.team_number, player1: t.player1, player2: t.player2, gamesWon: 0, finalRank: 99 };
        });
    }

    if (prevMatches) {
        prevMatches.forEach(m => {
            if (m.team_a_id && m.team_b_id && m.status === 'finished') {
                if (stats[m.team_a_id]) stats[m.team_a_id].gamesWon += Number(m.score_a);
                if (stats[m.team_b_id]) stats[m.team_b_id].gamesWon += Number(m.score_b);
            }
        });

        const maxT = currentTournament.max_teams;
        let finalRanks = {};
        if (maxT === 4) finalRanks = { 3: [1, 2], 4: [3, 4] };
        else if (maxT === 8) finalRanks = { 9: [1, 2], 10: [3, 4], 11: [5, 6], 12: [7, 8] };
        else if (maxT === 16) finalRanks = { 25: [1, 2], 26: [3, 4], 27: [5, 6], 28: [7, 8], 29: [9, 10], 30: [11, 12], 31: [13, 14], 32: [15, 16] };

        Object.entries(finalRanks).forEach(([mNum, ranks]) => {
            const m = prevMatches.find(x => x.match_number == mNum);
            if (m && m.status === 'finished' && m.winner_team_id && m.team_a_id && m.team_b_id) {
                const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
                if (stats[m.winner_team_id]) stats[m.winner_team_id].finalRank = ranks[0];
                if (stats[loserId]) stats[loserId].finalRank = ranks[1];
            }
        });
    }

    // Sorter hold efter deres placeringsrang (Seed 1, Seed 2, Seed 3...)
    const orderedTeams = Object.values(stats).sort((a, b) => {
        if (a.finalRank !== b.finalRank) return a.finalRank - b.finalRank;
        return b.gamesWon - a.gamesWon;
    });

    // 3. Opret ny turnering i tilmeldingsfasen
    const { data: newT, error } = await client.from('tournaments').insert({
        name: newName,
        admin_username: currentUser,
        admin_contact: currentTournament.admin_contact || '',
        format: currentTournament.format,
        max_teams: currentTournament.max_teams,
        status: 'registration'
    }).select().single();

    if (error) return showCustomAlert("Fejl ved oprettelse: " + error.message, "Fejl", "❌");

    // 4. Gem de seedede hold i den nye turnering (Hold #1 = Seed 1 (Vinder), Hold #2 = Seed 2, etc.)
    const newTeamsToInsert = [];
    for (let i = 1; i <= newT.max_teams; i++) {
        const seededTeam = orderedTeams[i - 1];
        newTeamsToInsert.push({
            tournament_id: newT.id,
            team_number: i,
            player1: seededTeam ? seededTeam.player1 : null,
            player2: seededTeam ? seededTeam.player2 : null
        });
    }

    await client.from('teams').insert(newTeamsToInsert);

    await showCustomAlert(`Turneringen "${newName}" er oprettet! Holdene er automatisk seedet baseret på forrige placeringsstigning (Hold 1 = 1. plads, Hold 2 = 2. plads osv.).`, "Turnering Seedet & Oprettet 🏆", "🚀");
    openTournament(newT.id);
}
