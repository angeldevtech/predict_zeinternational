document.addEventListener('DOMContentLoaded', () => {
    let teams = [];
    let matches = [];

    Promise.all([
        fetch('teams.json').then(response => response.json()),
        fetch('matches.json').then(response => response.json())
    ]).then(([teamsData, matchesData]) => {
        teams = teamsData.teams;
        matches = matchesData.matches;

        initialize();
    });
    
    function initialize() {
        renderUpcomingMatches();
        updateRankings();
        renderMatchMatrix();
        setupEventListeners();
    }

    function getTeamById(id) {
        return teams.find(team => team.id === id);
    }

    function renderUpcomingMatches() {
        const container = document.getElementById('upcoming-matches');
        container.innerHTML = '';
        const upcoming = matches.filter(m => m.winner_id === null);

        upcoming.forEach((match, index) => {
            const team1 = getTeamById(match.team1_id);
            const team2 = getTeamById(match.team2_id);

            const matchEl = document.createElement('div');
            matchEl.className = 'prediction-match';
            
            const matchIndex = matches.indexOf(match);

            matchEl.innerHTML = `
                <div class="teams">
                    <div class="team-card" data-match-index="${matchIndex}" data-team-id="${team1.id}">
                        <img src="${team1.logo}" alt="${team1.name} logo">
                        <span>${team1.name}</span>
                    </div>
                    <span class="vs">VS</span>
                    <div class="team-card" data-match-index="${matchIndex}" data-team-id="${team2.id}">
                        <img src="${team2.logo}" alt="${team2.name} logo">
                        <span>${team2.name}</span>
                    </div>
                </div>
            `;
            container.appendChild(matchEl);
        });
    }

    function updateRankings() {
        const teamScores = JSON.parse(JSON.stringify(teams)).map(t => ({ ...t, wins: 0, losses: 0 }));

        matches.forEach(match => {
            const winnerId = match.predicted_winner_id !== undefined ? match.predicted_winner_id : match.winner_id;
            if (winnerId === null || winnerId === undefined) return;

            const team1 = teamScores.find(t => t.id === match.team1_id);
            const team2 = teamScores.find(t => t.id === match.team2_id);

            if (!team1 || !team2) return;

            if (winnerId === team1.id) {
                team1.wins++;
                team2.losses++;
            } else {
                team2.wins++;
                team1.losses++;
            }
        });

        teamScores.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
        renderRankings(teamScores);
    }

    function renderRankings(sortedTeams) {
        const tbody = document.querySelector('#rankings-table tbody');
        tbody.innerHTML = '';
        let currentRank = 0;
        let lastTeam = null;

        sortedTeams.forEach((team, index) => {
            if (!lastTeam || team.wins !== lastTeam.wins || team.losses !== lastTeam.losses) {
                currentRank = index + 1;
            }

            let classification = '';
            if (currentRank <= 4) classification = 'winner-bracket';
            else if (currentRank <= 6) classification = 'loser-bracket';
            else classification = 'eliminated';

            const row = document.createElement('tr');
            row.className = classification;
            row.innerHTML = `
                <td class="text-center">${currentRank}</td>
                <td>
                    <div class="team-rank">
                        <img src="${team.logo}" alt="${team.name} logo">
                        ${team.name}
                    </div>
                </td>
                <td class="text-center">${team.wins} - ${team.losses}</td>
            `;
            tbody.appendChild(row);
            lastTeam = team;
        });
    }

    function renderMatchMatrix() {
        const container = document.getElementById('match-matrix');
        container.innerHTML = '';
        const numTeams = teams.length;
        container.style.gridTemplateColumns = `repeat(${numTeams + 1}, 60px)`;
        
        const sortedTeams = [...teams].sort((a, b) => a.id - b.id);

        // Header row (Top)
        container.appendChild(document.createElement('div')); // Empty corner
        sortedTeams.forEach(team => {
            const headerCell = document.createElement('div');
            headerCell.className = 'matrix-header matrix-header-top';
            headerCell.innerHTML = `<img src="${team.logo}" title="${team.name}">`;
            headerCell.dataset.colTeamId = team.id;
            container.appendChild(headerCell);
        });

        // Team rows (Side headers + Cells)
        sortedTeams.forEach(rowTeam => {
            const rowHeader = document.createElement('div');
            rowHeader.className = 'matrix-header matrix-header-side';
            rowHeader.innerHTML = `<img src="${rowTeam.logo}" title="${rowTeam.name}">`;
            rowHeader.dataset.rowTeamId = rowTeam.id;
            container.appendChild(rowHeader);

            sortedTeams.forEach(colTeam => {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.dataset.rowTeamId = rowTeam.id;
                cell.dataset.colTeamId = colTeam.id;

                if (rowTeam.id === colTeam.id) {
                    cell.style.backgroundColor = '#1a1a1a';
                } else {
                    const match = matches.find(m =>
                        (m.team1_id === rowTeam.id && m.team2_id === colTeam.id) ||
                        (m.team1_id === colTeam.id && m.team2_id === rowTeam.id)
                    );
                    if (match) {
                        const isPredicted = match.predicted_winner_id !== undefined && match.winner_id === null;
                        const winnerId = isPredicted ? match.predicted_winner_id : match.winner_id;

                        if (winnerId !== null && winnerId !== undefined) {
                            if (winnerId === rowTeam.id) {
                                cell.classList.add(isPredicted ? 'matrix-predicted-win' : 'matrix-win');
                                cell.textContent = 'W';
                            } else {
                                cell.classList.add(isPredicted ? 'matrix-predicted-loss' : 'matrix-loss');
                                cell.textContent = 'L';
                            }
                        }
                    }
                }
                container.appendChild(cell);
            });
        });
    }
    
    function setupEventListeners() {
        // Prediction Clicks 
        document.getElementById('upcoming-matches').addEventListener('click', e => {
            const card = e.target.closest('.team-card');
            if (!card) return;

            const matchIndex = parseInt(card.dataset.matchIndex, 10);
            const teamId = parseInt(card.dataset.teamId, 10);
            const matchContainer = card.closest('.prediction-match');

            if (card.classList.contains('selected')) {
                card.classList.remove('selected');
                matches[matchIndex].predicted_winner_id = null;
            } else {
                matchContainer.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                matches[matchIndex].predicted_winner_id = teamId;
            }
            
            updateRankings();
            renderMatchMatrix();
        });

        // Clear Predictions Button
        document.getElementById('clear-predictions-btn').addEventListener('click', () => {
            matches.forEach(match => {
                if (match.winner_id === null) {
                    match.predicted_winner_id = null;
                }
            });
            document.querySelectorAll('.team-card.selected').forEach(c => c.classList.remove('selected'));
            updateRankings();
            renderMatchMatrix();
        });

        // Matrix Hover Effects
        const matrix = document.getElementById('match-matrix');
        matrix.addEventListener('mouseover', e => {
            const target = e.target;
            const topHeader = target.closest('.matrix-header-top');
            const sideHeader = target.closest('.matrix-header-side');
            const cell = target.closest('.matrix-cell');

            if (!topHeader && !sideHeader && !cell) return;

            matrix.classList.add('is-hovering');

            if (topHeader) {
                // Hovering on top header: highlight column
                const teamId = topHeader.dataset.colTeamId;
                document.querySelectorAll(`[data-col-team-id="${teamId}"]`).forEach(el => el.classList.add('highlight'));
            } else if (sideHeader) {
                // Hovering on side header: highlight row
                const teamId = sideHeader.dataset.rowTeamId;
                document.querySelectorAll(`[data-row-team-id="${teamId}"]`).forEach(el => el.classList.add('highlight'));
            } else if (cell) {
                // Hovering on a match cell: highlight row and column
                const rowTeamId = cell.dataset.rowTeamId;
                const colTeamId = cell.dataset.colTeamId;
                document.querySelectorAll(`[data-row-team-id="${rowTeamId}"], [data-col-team-id="${colTeamId}"]`).forEach(el => el.classList.add('highlight'));
            }
        });

        matrix.addEventListener('mouseout', () => {
            matrix.classList.remove('is-hovering');
            matrix.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));
        });
    }
});