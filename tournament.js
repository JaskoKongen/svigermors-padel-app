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
        return alert("Der skal være mindst 2 hold tilmeldt for at starte turneringen.");
    }

    if (!confirm(`Vil du starte turneringen nu med de ${targetTeams} tilmeldte hold?`)) return;

    let effectiveMaxTeams = currentTournament.max_teams;

    // Hvis der f.eks. er 4 tilmeldte hold i en 8-holds turnering og admin starter før tid:
    if (targetTeams <= 4 && currentTournament.max_teams > 4) {
        effectiveMaxTeams = 4;
        await client.from('tournaments').update({ max_teams: 4 }).eq('id', currentTournamentId);
        currentTournament.max_teams = 4;
    }

    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

    // Slet eventuelle tidligere kampe for denne turnering
    await client.from('matches').delete().eq('tournament_id', currentTournamentId);

    const matchesToCreate = [];

    if (effectiveMaxTeams === 4) {
        // 4 Hold: 2 runder (4 kampe totalt)
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 1, round: 1, match_type: "🚀 Semifinale 1", team_a_id: shuffledTeams[0]?.id || null, team_b_id: shuffledTeams[1]?.id || null, status: 'ready' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 2, round: 1, match_type: "🚀 Semifinale 2", team_a_id: shuffledTeams[2]?.id || null, team_b_id: shuffledTeams[3]?.id || null, status: 'ready' });

        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 3, round: 2, match_type: "🏆 FINALE", team_a_id: null, team_b_id: null, status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 4, round: 2, match_type: "🥉 3./4. PLADS", team_a_id: null, team_b_id: null, status: 'waiting' });
    } else {
        // 8 Hold (Standard): 3 runder (12 kampe totalt)
        for (let i = 0; i < 4; i++) {
            matchesToCreate.push({
                tournament_id: currentTournamentId,
                match_number: i + 1,
                round: 1,
                match_type: `🎾 Indledende Kamp ${i + 1}`,
                team_a_id: shuffledTeams[i * 2]?.id || null,
                team_b_id: shuffledTeams[i * 2 + 1]?.id || null,
                status: 'ready'
            });
        }
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 5, round: 2, match_type: "🚀 Semifinale 1", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 6, round: 2, match_type: "🚀 Semifinale 2", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 7, round: 2, match_type: "🔄 Taber-semi 1", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 8, round: 2, match_type: "🔄 Taber-semi 2", status: 'waiting' });

        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 9, round: 3, match_type: "🏆 FINALE", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 10, round: 3, match_type: "🥉 3./4. PLADS", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 11, round: 3, match_type: "🏅 5./6. PLADS", status: 'waiting' });
        matchesToCreate.push({ tournament_id: currentTournamentId, match_number: 12, round: 3, match_type: "🎖️ 7./8. PLADS", status: 'waiting' });
    }

    await client.from('matches').insert(matchesToCreate);
    await client.from('tournaments').update({ status: 'matches' }).eq('id', currentTournamentId);
    currentTournament.status = 'matches';

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
                    ${isAdmin ? `<button class="btn-primary" onclick="restartTournament()" style="padding:14px; font-size:14px;">🔄 Genopret turnering med samme hold & indstillinger</button>` : ''}
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

    const roundTitles = {
        1: currentTournament?.max_teams === 4 ? "Semifinaler" : "Runde 1 (Indledende)",
        2: currentTournament?.max_teams === 4 ? "Finaler & Placering" : "Runde 2 (Semifinaler)",
        3: "Runde 3 (Finaler & Placeringer)"
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

            const canEdit = isMyMatch && teamA && teamB;

            const card = document.createElement('div');
            card.className = isMyMatch ? 'card my-match' : 'card';
            card.style.marginBottom = '10px';
            card.style.padding = '16px';

            if (canEdit) {
                card.onclick = () => openScoreModal(match);
                card.classList.add('card-interactive');
            } else {
                card.style.cursor = 'default';
                card.style.opacity = '0.85';
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

            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--accent-blue); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap;">
                            ${match.match_type || 'Kamp ' + match.match_number}
                        </span>
                        ${canEdit && match.status !== 'finished' ? '<span style="font-size:11px; color:var(--accent-green-bright); font-weight:700;">DIN KAMP ✎</span>' : ''}
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
    if (currentTournament?.max_teams === 4) {
        const finalMatch = matches.find(m => m.match_number === 3 && m.status === 'finished');
        if (finalMatch && finalMatch.winner_team_id) {
            const loserId = finalMatch.winner_team_id === finalMatch.team_a_id ? finalMatch.team_b_id : finalMatch.team_a_id;
            if (stats[finalMatch.winner_team_id]) stats[finalMatch.winner_team_id].finalRank = 1;
            if (stats[loserId]) stats[loserId].finalRank = 2;
        }
        const match3rd = matches.find(m => m.match_number === 4 && m.status === 'finished');
        if (match3rd && match3rd.winner_team_id) {
            const loserId = match3rd.winner_team_id === match3rd.team_a_id ? match3rd.team_b_id : match3rd.team_a_id;
            if (stats[match3rd.winner_team_id]) stats[match3rd.winner_team_id].finalRank = 3;
            if (stats[loserId]) stats[loserId].finalRank = 4;
        }
    } else {
        // 8 Hold placeringskampe: Kamp 9 (1/2), Kamp 10 (3/4), Kamp 11 (5/6), Kamp 12 (7/8)
        const finalRanks = { 9: [1, 2], 10: [3, 4], 11: [5, 6], 12: [7, 8] };
        Object.entries(finalRanks).forEach(([mNum, ranks]) => {
            const m = matches.find(x => x.match_number == mNum);
            if (m && m.status === 'finished' && m.winner_team_id && m.team_a_id && m.team_b_id) {
                const loserId = m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
                if (stats[m.winner_team_id]) stats[m.winner_team_id].finalRank = ranks[0];
                if (stats[loserId]) stats[loserId].finalRank = ranks[1];
            }
        });
    }

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
    const sA = parseInt(document.getElementById('score-a').value) || 0;
    const sB = parseInt(document.getElementById('score-b').value) || 0;

    if (sA === sB) return alert("Der skal findes en vinder! Ingen uafgjorte resultat tilladt.");

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

async function advanceTeams(tId, matchNum, winnerId, loserId) {
    if (currentTournament?.max_teams === 4) {
        // 4 Hold: Kamp 1 & 2 går til Kamp 3 (Finale) & Kamp 4 (3. plads)
        const p = {
            1: { w: [3, 'team_a_id'], l: [4, 'team_a_id'] },
            2: { w: [3, 'team_b_id'], l: [4, 'team_b_id'] }
        };
        const n = p[matchNum];
        if (n) {
            let uw = {}; uw[n.w[1]] = winnerId;
            await client.from('matches').update(uw).eq('tournament_id', tId).eq('match_number', n.w[0]);

            let ul = {}; ul[n.l[1]] = loserId;
            await client.from('matches').update(ul).eq('tournament_id', tId).eq('match_number', n.l[0]);
        }
    } else {
        // 8 Hold: TILFÆLDIG LODTRÆKNING (RANDOM SEEDING) AF SEMIFINALER EFTER RUNDE 1
        const { data: r1Matches } = await client
            .from('matches')
            .select('*')
            .eq('tournament_id', tId)
            .eq('round', 1);

        const finishedR1 = r1Matches.filter(m => m.status === 'finished');

        if (finishedR1.length === 4) {
            // Tjek om semifinalerne allerede er blevet parret
            const { data: semi1 } = await client.from('matches').select('*').eq('tournament_id', tId).eq('match_number', 5).single();

            if (!semi1.team_a_id) {
                // Alle 4 indledende kampe er færdige! Træk nu 100% tilfældigt lod blandt vinderne og taberne
                const winners = finishedR1.map(m => m.winner_team_id);
                const losers = finishedR1.map(m => (m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id));

                const shuffledWinners = [...winners].sort(() => Math.random() - 0.5);
                const shuffledLosers = [...losers].sort(() => Math.random() - 0.5);

                // Semi 1 (Kamp 5) & Semi 2 (Kamp 6)
                await client.from('matches').update({ team_a_id: shuffledWinners[0], team_b_id: shuffledWinners[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 5);
                await client.from('matches').update({ team_a_id: shuffledWinners[2], team_b_id: shuffledWinners[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 6);

                // Taber-semi 1 (Kamp 7) & Taber-semi 2 (Kamp 8)
                await client.from('matches').update({ team_a_id: shuffledLosers[0], team_b_id: shuffledLosers[1], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 7);
                await client.from('matches').update({ team_a_id: shuffledLosers[2], team_b_id: shuffledLosers[3], status: 'ready' }).eq('tournament_id', tId).eq('match_number', 8);
            }
        }

        // Progression fra Runde 2 til Runde 3 (Finalerne 1-8 plads)
        if (matchNum >= 5 && matchNum <= 8) {
            const finalMap = {
                5: { w: [9, 'team_a_id'], l: [10, 'team_a_id'] },
                6: { w: [9, 'team_b_id'], l: [10, 'team_b_id'] },
                7: { w: [11, 'team_a_id'], l: [12, 'team_a_id'] },
                8: { w: [11, 'team_b_id'], l: [12, 'team_b_id'] }
            };
            const fn = finalMap[matchNum];
            if (fn) {
                let uw = {}; uw[fn.w[1]] = winnerId;
                await client.from('matches').update(uw).eq('tournament_id', tId).eq('match_number', fn.w[0]);

                let ul = {}; ul[fn.l[1]] = loserId;
                await client.from('matches').update(ul).eq('tournament_id', tId).eq('match_number', fn.l[0]);
            }
        }
    }
}

async function restartTournament() {
    if (!currentTournament) return;
    const isAdmin = currentTournament.admin_username && currentTournament.admin_username.toLowerCase() === (currentUser || '').toLowerCase();
    if (!isAdmin) return alert("Kun Admin kan genoprette turneringen.");

    if (!confirm(`Vil du genoprette turneringen "${currentTournament.name}"?\n\nDette opretter en ny udgave i tilmeldingsfasen med alle eksisterende hold kopieret over, så spillere kan framelde sig eller nye kan deltage.`)) return;

    // 1. Hent alle eksisterende hold i den færdige turnering
    const { data: oldTeams } = await client
        .from('teams')
        .select('*')
        .eq('tournament_id', currentTournamentId)
        .order('team_number', { ascending: true });

    // 2. Opret ny turnering i tilmeldingsfasen (status = 'registration')
    const { data: newT, error } = await client.from('tournaments').insert({
        name: currentTournament.name + " (Ny)",
        admin_username: currentUser,
        admin_contact: currentTournament.admin_contact,
        format: currentTournament.format,
        max_teams: currentTournament.max_teams,
        status: 'registration'
    }).select().single();

    if (error) return alert("Fejl ved oprettelse: " + error.message);

    // 3. Kopier spillere over i de nye hold
    const newTeamsToInsert = [];
    for (let i = 1; i <= newT.max_teams; i++) {
        const oldTeam = oldTeams ? oldTeams.find(t => t.team_number === i) : null;
        newTeamsToInsert.push({
            tournament_id: newT.id,
            team_number: i,
            player1: oldTeam ? oldTeam.player1 : null,
            player2: oldTeam ? oldTeam.player2 : null
        });
    }

    await client.from('teams').insert(newTeamsToInsert);

    alert("Turneringen er genoprettet i tilmeldingsfasen med alle spillere kopieret over! Du kan starte turneringen, når holdene er bekræftet.");
    openTournament(newT.id);
}
