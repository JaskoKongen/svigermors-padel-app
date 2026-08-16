async function fetchTeams() {
    if (!currentTournamentId) return;

    const { data: teams } = await client
        .from('teams')
        .select('*')
        .eq('tournament_id', currentTournamentId)
        .order('team_number', { ascending: true });

    const listDiv = document.getElementById('teams-list');
    if (!listDiv || !teams) return;
    listDiv.innerHTML = '';

    const isSingle = currentTournament.format === 'single';
    let playerCount = 0;
    const maxTeams = currentTournament.max_teams;
    const maxCapacity = isSingle ? maxTeams : maxTeams * 2;
    const currentUserOnAnyTeam = teams.some(t => t.player1 === currentUser || t.player2 === currentUser);

    let filledTeamsCount = 0;

    teams.forEach(team => {
        const isTeamFilled = isSingle ? Boolean(team.player1) : Boolean(team.player1 && team.player2);
        if (isTeamFilled) filledTeamsCount++;

        if (team.player1) playerCount++;
        if (!isSingle && team.player2) playerCount++;

        const card = document.createElement('div');
        card.className = 'team-card';
        const onThisTeam = team.player1 === currentUser || team.player2 === currentUser;

        let actionHtml = '';
        if (onThisTeam) {
            actionHtml = `<button class="btn-danger btn-sm" onclick="leaveTeam(${team.id})">Afmeld</button>`;
        } else if (!currentUserOnAnyTeam && (!team.player1 || (!isSingle && !team.player2))) {
            actionHtml = `<button class="btn-primary btn-sm" onclick="joinTeam(${team.id})">Tilmeld</button>`;
        }

        let playersHtml = `<div class="player-name">${team.player1 || '<span class="empty-slot">Ledig plads</span>'}</div>`;
        if (!isSingle) {
            playersHtml += `<div class="player-name">${team.player2 || '<span class="empty-slot">Ledig plads</span>'}</div>`;
        }

        card.innerHTML = `
            <div class="team-info">
                <strong style="font-size: 15px; color: var(--text-main);">Hold ${team.team_number}</strong>
                ${playersHtml}
            </div>
            ${actionHtml}`;
        listDiv.appendChild(card);
    });

    const adminDiv = document.getElementById('admin-controls-section');
    if (adminDiv) {
        const isAdmin = currentTournament.admin_username === currentUser;

        if (filledTeamsCount === maxTeams) {
            // Fuld turnering!
            if (isAdmin) {
                adminDiv.innerHTML = `<button class="btn-primary" onclick="startTournament()" style="padding:16px; font-size:15px;">🚀 START TURNERING (${maxTeams} Hold)</button>`;
            } else {
                adminDiv.innerHTML = `<p style="text-align:center; color:var(--accent-green-bright); font-size:13px; margin:0;">Alle ${maxTeams} hold er tilmeldt! Venter på at admin (${currentTournament.admin_username}) starter turneringen...</p>`;
            }
        } else {
            // Tjek om det aktuelle antal tilmeldte hold er en gyldig turneringsstørrelse (fx 4 hold i en 8-holds turnering)
            const isEarlyValid = (maxTeams === 8 && filledTeamsCount === 4) || 
                                 (maxTeams === 16 && (filledTeamsCount === 4 || filledTeamsCount === 8));

            if (isEarlyValid) {
                if (isAdmin) {
                    adminDiv.innerHTML = `
                        <div style="text-align:center; background: rgba(125,125,125,0.06); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-card);">
                            <p style="color:var(--text-muted); font-size:12px; margin:0 0 10px 0;">Der er tilmeldt <strong>${filledTeamsCount} ud af ${maxTeams} hold</strong>.</p>
                            <button class="btn-primary" onclick="startTournament(${filledTeamsCount})" style="padding:12px 16px; font-size:14px;">🚀 Start turnering før tid med ${filledTeamsCount} hold</button>
                        </div>`;
                } else {
                    adminDiv.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin:0;">Der er ${filledTeamsCount}/${maxTeams} hold tilmeldt. Venter på flere deltagere...</p>`;
                }
            } else {
                // Ikke en gyldig tidlig start-størrelse endnu (fx 1, 2, 3, 5, 6, 7 hold)
                adminDiv.innerHTML = `
                    <div style="text-align:center; background: rgba(125,125,125,0.05); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-card);">
                        <p style="color:var(--text-muted); font-size:13px; margin:0;">Venter på deltagere... (${filledTeamsCount}/${maxTeams} hold tilmeldt)</p>
                    </div>`;
            }
        }
    }
}

async function joinTeam(id) {
    const { data: team } = await client.from('teams').select('*').eq('id', id).single();
    const isSingle = currentTournament.format === 'single';

    let updateData = {};
    if (isSingle) {
        updateData = { player1: currentUser };
    } else {
        updateData = !team.player1 ? { player1: currentUser } : { player2: currentUser };
    }

    await client.from('teams').update(updateData).eq('id', id);
    fetchTeams();
}

async function leaveTeam(id) {
    const { data: team } = await client.from('teams').select('*').eq('id', id).single();
    let updateData = {};

    if (team.player1 === currentUser) {
        updateData = { player1: null };
    } else if (team.player2 === currentUser) {
        updateData = { player2: null };
    }

    await client.from('teams').update(updateData).eq('id', id);
    fetchTeams();
}
