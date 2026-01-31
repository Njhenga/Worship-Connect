

$(document).ready(function() {
    // -------------------------
    // Output page logic
    // -------------------------
    const outputContainer = $("#outputContainer");
    if (outputContainer.length) {  // Only runs if this page has #outputContainer
      console.log("output page loaded");
      const socket = io(); // connect to server

       //showing the default
       const DEFAULT_MESSAGE = "Welcome To Today's Service";
       $("outputContainer").html(`<h1>${DEFAULT_MESSAGE}</h1>`);
       let resetTimeout; // store the timeout so we can clear it if needed
 
 function showDefaultMessage(delay = 120000) { // 120000ms = 2 min
   // Clear any previous timeout so it doesn’t overwrite new content
   clearTimeout(resetTimeout);
 
   resetTimeout = setTimeout(() => {
     $("#outputContainer").html(`<h2>${DEFAULT_MESSAGE}</h2>`);
   }, delay);
 }

  ///songs and lyrics 
      socket.on("displaySong", (data) => {
        console.log("📺 Output received data:", data);
         
        $("#outputContainer").html(`<h2>${data.title}</h2><p>${data.lyrics}</p>`);
        showDefaultMessage(120000)
      
    });

      //Announcements
      socket.on("announcementUpdate", (data) => {
        console.log("output receives:", data);
        $("#outputContainer").html(`
            <p>${data.text}</p>
        `);
        showDefaultMessage(120000);
      });

      //Bible Verses
      socket.on("displayBible", data => {
        $("#outputContainer").html(`
          <h2>${data.reference}</h2>
          <p>${data.text}</p>
        `);
        showDefaultMessage(120000);
      });

    }
  
    // -------------------------
    // Admin page logic
    // -------------------------
    const adminContainer = $("#adminContainer");
    if (adminContainer.length) {  // Only runs if this page has #adminContainer
      const socket = io();
      // Save button click
      $("#saveSongBtn").click(function () {
        const title = $("#songTitle").val().trim();
        const lyrics = $("#songLyrics").val().trim();
    
        if (!title || !lyrics) {
            alert("Please enter song title and lyrics");
            return;
        }
    
        console.log("💾 Saving song:", { title, lyrics }); // Debug log
    
        axios.post("/api/song", { title, lyrics })
            .then(res => {
                console.log("✅ Song saved successfully:", res.data); // Debug log
                alert("Song saved successfully");
                $("#songLyrics").val("");  // Clear lyrics input
                $("#songTitle").val("");   // Optional: clear title input
            })
            .catch(err => {
                console.error("❌ Error saving song:", err);
                alert("Error saving song");
            });
    });
      // Load Song Button
$("#loadSongBtn").click(function () {
  const title = $("#searchSongTitle").val().trim();

  if (!title) {
      alert("Enter song title to search");
      return;
  }

  console.log("🔍 Loading song:", title); // Debug log

  axios.get(`/api/song/${encodeURIComponent(title)}`)
      .then(res => {
          const { lyrics } = res.data;
          console.log("🎵 Song lyrics fetched:", lyrics); // Debug log

          // 🔑 Split by empty line = verse or chorus
          const blocks = lyrics
              .split(/\n\s*\n/)   // splits on empty line
              .map(b => b.trim())
              .filter(b => b !== "");

          const container = $("#songDisplayContainer");
          container.empty();

          // Display each verse/chorus with Send Live button
          blocks.forEach(block => {
              container.append(`
                  <div class="song-block">
                      <pre>${block}</pre>
                      <button class="sendSongLiveBtn"
                              data-title="${title}"
                              data-block="${block.replace(/"/g, "&quot;")}">
                          Send Live
                      </button>
                  </div>
                  <hr> 
              `);
          });
      })
      .catch(err => {
          console.error("❌ Error fetching song:", err);
          alert("Song not found");
      });
});
      // Send Song Live (verse/chorus)
      $(document).on("click", ".sendSongLiveBtn", function () {
        const title = $(this).attr("data-title");
        const text  = $(this).attr("data-block");
    
        console.log("🖱️ Send Live clicked:", { title, text });
    
        socket.emit("songLive", {
            title: title,
            lyrics: text
        });
    });
/////////////////////////////////////////////////////////
      //Announcemments 
      //loadSavedAnnouncements();
      $("#saveAnnouncementBtn").click(function(event) {
        event.preventDefault();
    
        // Get the value from the textarea
        var announcementText = $("#announcementText").val();
    
        if (announcementText.trim() !== "") {
            // Send to server
            axios.post("/announcementText", { announcementText: announcementText })
                .then(function(response) {
                    alert("Announcement Posted");
                   // loadSavedAnnouncements(); // introduced button instead
                })
                .catch(function(err) {
                    console.error(err);
                    alert("Error saving announcement");
                });
    
        } else {
            alert("Please add an announcement");
        }
    
        // Clear the textarea
        $("#announcementText").val("");
    });

     //button for sending live
     let announcementsLoaded = false; // prevent multiple loads

     $("#show").on("click", function () {
       // Optionally toggle: if already loaded, clear and hide
       if (announcementsLoaded) {
         $("#savedAnnouncements").empty();
         announcementsLoaded = false;
         $(this).text("show Announcements");
         return;
       }
   
       axios.get("/api/announcements")
         .then(res => {
           const announcements = res.data; // array of { text: "..." }
           const container = $("#savedAnnouncements");
           container.empty();
   
           announcements.forEach(a => {
             container.append(`
               <div class="announcement-block">
                 <p>${a.text}</p>
                 <button class="sendAnnouncementBtn" data-text="${a.text.replace(/"/g, "&quot;")}">
                   Send Live
                 </button>
               </div>
               <hr>
             `);
           });
   
           announcementsLoaded = true;
           $(this).text("hide Announcements");
         })
         .catch(err => {
           console.error(err);
           alert("Failed to load announcements");
         });
     });
   
     // Send an announcement live
     $(document).on("click", ".sendAnnouncementBtn", function () {
       const text = $(this).data("text");
       console.log("sending announcements live:", text);
       socket.emit("announcementLive", { text });
     });

    //Bible Verses Section
    // ===== FETCH VERSES FROM SERVER =====
    // Fetch verses when admin clicks "Fetch Verses"
    $("#fetchBibleBtn").click(function () {
      const query = $("#bibleQuery").val().trim();
    
      if (!query) {
        alert("Please enter a verse or range!");
        return;
      }
    
      // Call server to get verses
      axios.get("/api/bible", { params: { query } })
        .then(res => {
          const verses = res.data;
          const resultsContainer = $("#bibleResults");
          resultsContainer.empty(); // clear previous results
    
          verses.forEach(v => {
            // Add each verse with Send Live button
            resultsContainer.append(`
              <div class="verse-item">
                <strong>${v.reference}</strong><br>
                ${v.text}<br>
                <button class="sendVerseBtn" 
                        data-ref="${v.reference}" 
                        data-text="${v.text.replace(/'/g,"")}">
                  Send Live
                </button>
              </div>
              <hr>
            `);
          });
        })
        .catch(err => {
          console.error("Error fetching verses:", err);
          alert("Failed to fetch verses. Check console for details.");
        });
    });
    
    // Send a verse live when admin clicks its button
    $(document).on("click", ".sendVerseBtn", function () {
      const reference = $(this).data("ref");
      const text = $(this).data("text");
    
      // Send to server via Socket.IO
      socket.emit("bibleLive", { reference, text });
    });
    }
  
  });