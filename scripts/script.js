// Funktio, joka hakee teatterien tiedot ja lisää ne alasvetovalikkoon
$(document).ready(function() {
    // Kutsu fetchTheaters-funktiota, kun sivu on ladattu
    fetchTheaters();

    // Fade in sivun lataamisen yhteydessä
    $('body').fadeIn();

    // Kuuntele teatterin valinnan muutoksia ja päivitä elokuvat sen perusteella
    $('#theater-select').change(function() {
        var selectedTheaterId = $(this).val();
        $('#movies-list').fadeOut(function() {
            fetchMovies(selectedTheaterId);
            $(this).fadeIn();
        });
    });

    // Kuuntele hakukentän muutoksia ja päivitä elokuvat sen perusteella
    $('#search-input').on('input', function() {
        var searchString = $(this).val().trim();
        var selectedTheaterId = $('#theater-select').val();
        $('#movies-list').fadeOut(function() {
            fetchMovies(selectedTheaterId, searchString);
            $(this).fadeIn();
        });
    });
});
function fetchTheaters() {
    $.ajax({
        url: 'https://www.finnkino.fi/xml/TheatreAreas/',
        method: 'GET',
        dataType: 'xml',
        success: function(data) {
            $(data).find('TheatreArea').each(function() {
                var name = $(this).find('Name').text();
                var id = $(this).find('ID').text();
                $('#theater-select').append($('<option>', {
                    value: id,
                    text: name
                }));
            });

            // Päivitä elokuvat valitusta teatterista
            var selectedTheaterId = $('#theater-select').val();
            fetchMovies(selectedTheaterId);
        },
        error: function(error) {
            console.error('Error fetching theaters:', error);
        }
    });
}

// Funktio, joka hakee valitun teatterin elokuvatiedot ja näyttää ne ryhmiteltynä aakkosjärjestyksessä
function fetchMovies(theaterId, searchString = '') {
    var apiUrl = `https://www.finnkino.fi/xml/Schedule/?area=${theaterId}`;
    $.ajax({
        url: apiUrl,
        method: 'GET',
        dataType: 'xml',
        success: function(data) {
            var movies = $(data).find('Show');

            // Suorita hakusanalla suodatus, jos hakukenttä ei ole tyhjä
            if (searchString) {
                movies = $(movies).filter(function() {
                    var title = $(this).find('Title').text();
                    return new RegExp(searchString, 'i').test(title);
                });
            }

            var movieMap = new Map();
            $(movies).each(function() {
                var title = $(this).find('Title').text();
                var start = formatDateTime($(this).find('dttmShowStart').text());
                var end = formatDateTime($(this).find('dttmShowEnd').text());
                var imageUrl = $(this).find('EventSmallImagePortrait').text();

                if (!movieMap.has(title)) {
                    movieMap.set(title, []);
                }

                movieMap.get(title).push({ start: start, end: end, imageUrl: imageUrl });
            });

            var sortedMovies = [...movieMap.keys()].sort();

            // Haetaan elokuvien lyhyet kuvaukset
            fetchMovieDescriptions().then(function(descriptionsMap) {
                var moviesList = $('#movies-list');
                moviesList.empty(); // Tyhjennä lista ennen kuin lisätään uudet elokuvat

                // Näytetään elokuvat ja niiden näytösajat ryhmiteltynä
                sortedMovies.forEach(function(title) {
                    var movieDiv = $('<div>').addClass('movie-item');

                    var movieShowtimes = movieMap.get(title).map(function(showtime) {
                        return `<p>Start: ${showtime.start} - End: ${showtime.end}</p>`;
                    }).join('');

                    // Näytä lyhyt kuvaus, jos se on saatavilla
                    var description = descriptionsMap.get(title) || 'Description not available';
                    movieDiv.html(`
                        <h2>${title}</h2>
                        <img src="${movieMap.get(title)[0].imageUrl}" alt="${title} Image">
                        <p>${description}</p>
                        ${movieShowtimes}
                    `);
                    moviesList.append(movieDiv);
                });
            });
        },
        error: function(error) {
            console.error('Error fetching movies:', error);
        }
    });
}

// Funktio, joka hakee elokuvien lyhyet kuvaukset
function fetchMovieDescriptions() {
    const eventsUrl = 'https://www.finnkino.fi/xml/Events/';
    return fetch(eventsUrl)
        .then(response => response.text())
        .then(data => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, 'text/xml');
            const movies = xmlDoc.querySelectorAll('Event');
            const descriptionsMap = new Map();

            movies.forEach(movie => {
                const title = movie.querySelector('Title').textContent;
                const description = movie.querySelector('ShortSynopsis').textContent;
                descriptionsMap.set(title, description);
            });

            return descriptionsMap;
        })
        .catch(error => {
            console.error('Error fetching movie descriptions:', error);
            return new Map(); // Palauta tyhjä Map virhetilanteessa
        });
}

// Funktio, joka muuttaa päivämäärän ja ajan suomalaiseen muotoon
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
    const hours = (date.getHours() < 10 ? '0' : '') + date.getHours();
    const minutes = (date.getMinutes() < 10 ? '0' : '') + date.getMinutes();
    const formattedTime = `${hours}:${minutes}`;
    return `${formattedDate} ${formattedTime}`;
}
