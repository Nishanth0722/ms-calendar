// frappe.ui.form.on('Schedule interview', {
//     refresh: function(frm) {
//         frm.toggle_display('available_slots_section', false);
//     },

//     check_availability: function(frm) {
//         if (!frm.doc.interviewer_email || !frm.doc.interview_date) {
//             frappe.msgprint(__('Please enter interviewer email and interview date.'));
//             return;
//         }

//         frm.get_field('available_slots').$wrapper.html(`
//             <div class="text-center" style="margin-top: 20px;">
//                 <i class="fa fa-spinner fa-spin fa-2x"></i>
//                 <p>Checking availability...</p>
//             </div>
//         `);
//         frm.toggle_display('available_slots_section', true);

//         frappe.call({
//             method: 'ms_calendar.api.msgraph.get_schedule_free_slots',
//             args: {
//                 interviewer_email: frm.doc.interviewer_email,
//                 interview_date: frm.doc.interview_date
//             },
//             callback: function(r) {
//                 if (r.message) {
//                     const processedEvents = r.message.map(interval => {
//                         const startUtc = moment.utc(interval.start.dateTime);
//                         const endUtc = moment.utc(interval.end.dateTime);

//                         const start = startUtc.local();
//                         const end = endUtc.local();

//                         return {
//                             title: interval.subject || "Busy",
//                             type: interval.location?.displayName || "Meeting",
//                             attendee: interval.organizer?.emailAddress?.name || "Unknown",
//                             startHour: start.hours() + start.minutes() / 60,
//                             endHour: end.hours() + end.minutes() / 60,
//                             displayStartTime: start.format("h:mm A"),
//                             displayEndTime: end.format("h:mm A"),
//                             color: '#1abc9c'
//                         };
//                     });
//                     frm.events.display_schedule_design(frm, processedEvents);
//                 } else {
//                     frm.get_field('available_slots').$wrapper.html(`
//                         <div class="alert alert-danger" role="alert">
//                             An error occurred while fetching availability.
//                         </div>
//                     `);
//                 }
//             }
//         });
//     },

//     display_schedule_design: function(frm, events) {
//         const scheduleHtml = frm.events.generate_schedule_html(frm, events);
//         frm.get_field('available_slots').$wrapper.html(scheduleHtml);
//     },

//     generate_schedule_html: function(frm, events) {
//         const HOURLY_SLOT_WIDTH_PX = 80;
//         const day_start_hour = 6;
//         const day_end_hour = 18;

//         // Time labels row with half-hour markers
//         let timeSlotsHtml = '';
//         for (let i = day_start_hour; i <= day_end_hour; i += 0.5) {
//             const hour = i % 12 === 0 ? 12 : i % 12;
//             const minutes = i % 1 === 0 ? '00' : '30';
//             const ampm = i < 12 || i === 24 ? 'AM' : 'PM';
//             const isHour = i % 1 === 0;
//             timeSlotsHtml += `
//                 <div class="time-slot" style="
//                     min-width: ${HOURLY_SLOT_WIDTH_PX / 2}px;
//                     height: ${isHour ? '50px' : '30px'};
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: ${isHour ? '0.9em' : '0.75em'};
//                     color: ${isHour ? '#333' : '#666'};
//                     border-right: 1px solid #e0e0e0;
//                     border-bottom: 1px solid #e0e0e0;
//                     background-color: ${isHour ? '#f5f5f5' : '#fafafa'};
//                     box-sizing: border-box;
//                     text-align: center;
//                 ">
//                     ${isHour ? `${hour}:${minutes} ${ampm}` : `:${minutes}`}
//                 </div>
//             `;
//         }

//         // Events row with free slot indicators
//         let eventsHtml = '';
//         events.forEach((event, index) => {
//             if (event.endHour <= day_start_hour || event.startHour >= day_end_hour) {
//                 return;
//             }

//             const startHour = Math.max(event.startHour, day_start_hour);
//             const endHour = Math.min(event.endHour, day_end_hour);
//             const left = (startHour - day_start_hour) * HOURLY_SLOT_WIDTH_PX;
//             const width = (endHour - startHour) * HOURLY_SLOT_WIDTH_PX;

//             eventsHtml += `
//                 <div class="event" 
//                      role="button" 
//                      tabindex="0" 
//                      aria-label="${event.title} from ${event.displayStartTime} to ${event.displayEndTime}"
//                      style="
//                         position: absolute;
//                         top: 4px;
//                         bottom: 4px;
//                         left: ${left}px;
//                         width: ${width}px;
//                         margin: 0 2px;
//                         background: linear-gradient(135deg, ${event.color || '#3498db'}, ${event.color ? darkenColor(event.color, 20) : '#2980b9'});
//                         color: white;
//                         border-radius: 6px;
//                         padding: 6px 8px;
//                         font-size: 0.85em;
//                         box-shadow: 0 2px 4px rgba(0,0,0,0.15);
//                         overflow: hidden;
//                         white-space: nowrap;
//                         text-overflow: ellipsis;
//                         cursor: pointer;
//                         transition: transform 0.2s, box-shadow 0.2s;
//                      "
//                      onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)';"
//                      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.15)';">
//                     <div style="font-weight: 600;">${event.title}</div>
//                     <div style="font-size: 0.75em; opacity: 0.9;">
//                         ${event.displayStartTime} - ${event.displayEndTime}
//                     </div>
//                     <div class="tooltip" style="
//                         visibility: hidden;
//                         position: absolute;
//                         top: -40px;
//                         left: 50%;
//                         transform: translateX(-50%);
//                         background-color: #333;
//                         color: white;
//                         padding: 4px 8px;
//                         border-radius: 4px;
//                         font-size: 0.75em;
//                         z-index: 10;
//                     ">
//                         ${event.attendee} (${event.type})
//                     </div>
//                 </div>
//             `;
//         });

//         // Add free slot indicators
//         const freeSlots = frm.events.calculate_free_slots(events, day_start_hour, day_end_hour);
//         freeSlots.forEach(slot => {
//             const left = (slot.start - day_start_hour) * HOURLY_SLOT_WIDTH_PX;
//             const width = (slot.end - slot.start) * HOURLY_SLOT_WIDTH_PX;
//             eventsHtml += `
//                 <div class="free-slot" style="
//                     position: absolute;
//                     top: 4px;
//                     bottom: 4px;
//                     left: ${left}px;
//                     width: ${width}px;
//                     margin: 0 2px;
//                     background-color: rgba(46, 204, 113, 0.2);
//                     border: 2px dashed #2ecc71;
//                     border-radius: 6px;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: 0.85em;
//                     color: #2ecc71;
//                     font-weight: 500;
//                     cursor: default;
//                 ">
//                     Free
//                 </div>
//             `;
//         });

//         return `
//             <style>
//                 .schedule-container {
//                     width: 100%;
//                     max-width: 1000px;
//                     margin: 0 auto;
//                     border: 1px solid #d0d0d0;
//                     border-radius: 8px;
//                     background: linear-gradient(to bottom, #ffffff, #f8f9fa);
//                     box-shadow: 0 4px 12px rgba(0,0,0,0.1);
//                     font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
//                     overflow: hidden;
//                 }
//                 .schedule-container header {
//                     padding: 12px 16px;
//                     background: #f1f3f5;
//                     border-bottom: 1px solid #d0d0d0;
//                     font-weight: 600;
//                     font-size: 1.1em;
//                     color: #2c3e50;
//                 }
//                 .schedule-grid {
//                     display: flex;
//                     flex-direction: column;
//                     background: repeating-linear-gradient(
//                         to right,
//                         #e0e0e0,
//                         #e0e0e0 1px,
//                         transparent 1px,
//                         transparent ${HOURLY_SLOT_WIDTH_PX / 2}px
//                     );
//                 }
//                 .time-row {
//                     display: flex;
//                     border-bottom: 1px solid #d0d0d0;
//                     overflow-x: auto;
//                     scrollbar-width: thin;
//                     scrollbar-color: #adb5bd #f1f3f5;
//                 }
//                 .time-row::-webkit-scrollbar {
//                     height: 8px;
//                 }
//                 .time-row::-webkit-scrollbar-thumb {
//                     background: #adb5bd;
//                     border-radius: 4px;
//                 }
//                 .events-row {
//                     position: relative;
//                     height: 120px;
//                     overflow-x: auto;
//                     overflow-y: hidden;
//                     scrollbar-width: thin;
//                     scrollbar-color: #adb5bd #f1f3f5;
//                 }
//                 .events-row::-webkit-scrollbar {
//                     height: 8px;
//                 }
//                 .events-row::-webkit-scrollbar-thumb {
//                     background: #adb5bd;
//                     border-radius: 4px;
//                 }
//                 .event:hover .tooltip {
//                     visibility: visible;
//                 }
//                 @media (max-width: 768px) {
//                     .time-slot {
//                         min-width: ${HOURLY_SLOT_WIDTH_PX / 1.5}px !important;
//                         font-size: ${0.75 * 0.9}em !important;
//                     }
//                     .event, .free-slot {
//                         font-size: 0.75em !important;
//                         padding: 4px 6px !important;
//                     }
//                     .schedule-container header {
//                         font-size: 1em;
//                     }
//                 }
//             </style>
//             <div class="schedule-container">
//                 <header>
//                     ${moment(frm.doc.interview_date).format('dddd, MMMM DD, YYYY')}
//                 </header>
//                 <div class="schedule-grid">
//                     <div class="time-row">
//                         ${timeSlotsHtml}
//                     </div>
//                     <div class="events-row">
//                         ${eventsHtml}
//                     </div>
//                 </div>
//             </div>
//         `;
//     },

//     calculate_free_slots: function(events, day_start_hour, day_end_hour) {
//         const slots = [];
//         let currentHour = day_start_hour;

//         const sortedEvents = events
//             .filter(e => e.endHour > day_start_hour && e.startHour < day_end_hour)
//             .sort((a, b) => a.startHour - b.startHour);

//         sortedEvents.forEach(event => {
//             const start = Math.max(event.startHour, day_start_hour);
//             if (currentHour < start) {
//                 slots.push({ start: currentHour, end: start });
//             }
//             currentHour = Math.max(currentHour, event.endHour);
//         });

//         if (currentHour < day_end_hour) {
//             slots.push({ start: currentHour, end: day_end_hour });
//         }

//         return slots;
//     }
// });

// // Helper function to darken color for gradient
// function darkenColor(hex, percent) {
//     // Remove # from hex code
//     let color = hex.replace('#', '');
//     // Parse RGB components
//     let r = parseInt(color.substr(0, 2), 16);
//     let g = parseInt(color.substr(2, 2), 16);
//     let b = parseInt(color.substr(4, 2), 16);
    
//     // Darken by percentage
//     r = Math.round(r * (100 - percent) / 100);
//     g = Math.round(g * (100 - percent) / 100);
//     b = Math.round(b * (100 - percent) / 100);
    
//     // Ensure values stay within 0-255
//     r = r < 0 ? 0 : r;
//     g = g < 0 ? 0 : g;
//     b = b < 0 ? 0 : b;
    
//     // Convert back to hex
//     return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0')}`;
// }

// frappe.ui.form.on('Schedule interview', {
//     refresh: function(frm) {
//         frm.toggle_display('available_slots_section', false);
//     },

//     check_availability: function(frm) {
//         if (!frm.doc.interviewer_email || !frm.doc.interview_date) {
//             frappe.msgprint(__('Please enter interviewer email and interview date.'));
//             return;
//         }

//         frm.get_field('available_slots').$wrapper.html(`
//             <div class="text-center" style="margin-top: 20px;">
//                 <i class="fa fa-spinner fa-spin fa-2x"></i>
//                 <p>Checking availability...</p>
//             </div>
//         `);
//         frm.toggle_display('available_slots_section', true);

//         frappe.call({
//             method: 'ms_calendar.api.msgraph.get_schedule_free_slots',
//             args: {
//                 interviewer_email: frm.doc.interviewer_email,
//                 interview_date: frm.doc.interview_date
//             },
//             callback: function(r) {
//                 if (r.message) {
//                     const processedEvents = r.message.map(interval => {
//                         const startUtc = moment.utc(interval.start.dateTime);
//                         const endUtc = moment.utc(interval.end.dateTime);

//                         const start = startUtc.local();
//                         const end = endUtc.local();

//                         return {
//                             title: interval.subject || "Busy",
//                             type: interval.location?.displayName || "Meeting",
//                             attendee: interval.organizer?.emailAddress?.name || "Unknown",
//                             startHour: start.hours() + start.minutes() / 60,
//                             endHour: end.hours() + end.minutes() / 60,
//                             displayStartTime: start.format("h:mm A"),
//                             displayEndTime: end.format("h:mm A"),
//                             color: '#e74c3c' // Changed to red for busy slots
//                         };
//                     });
//                     frm.events.display_schedule_design(frm, processedEvents);
//                 } else {
//                     frm.get_field('available_slots').$wrapper.html(`
//                         <div class="alert alert-danger" role="alert">
//                             An error occurred while fetching availability.
//                         </div>
//                     `);
//                 }
//             }
//         });
//     },

//     display_schedule_design: function(frm, events) {
//         const scheduleHtml = frm.events.generate_schedule_html(frm, events);
//         frm.get_field('available_slots').$wrapper.html(scheduleHtml);
//     },

//     generate_schedule_html: function(frm, events) {
//         const MAX_CONTAINER_WIDTH = 1000; // Max width of the schedule container in pixels
//         const day_start_hour = 6;   // 6 AM
//         const day_end_hour = 18;    // 6 PM
//         const total_hours = day_end_hour - day_start_hour; // 12 hours
//         const total_half_hours = total_hours * 2; // 24 half-hour slots
//         const HOURLY_SLOT_WIDTH_PX = Math.floor(MAX_CONTAINER_WIDTH / total_hours); // Dynamic width per hour
//         const HALF_HOURLY_SLOT_WIDTH_PX = HOURLY_SLOT_WIDTH_PX / 2; // Width per half-hour

//         // Time labels row with half-hour markers
//         let timeSlotsHtml = '';
//         for (let i = day_start_hour; i <= day_end_hour; i += 0.5) {
//             const hour = i % 12 === 0 ? 12 : i % 12;
//             const minutes = i % 1 === 0 ? '00' : '30';
//             const ampm = i < 12 || i === 24 ? 'AM' : 'PM';
//             const isHour = i % 1 === 0;
//             timeSlotsHtml += `
//                 <div class="time-slot" style="
//                     width: ${HALF_HOURLY_SLOT_WIDTH_PX}px;
//                     height: ${isHour ? '50px' : '30px'};
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: ${isHour ? '0.9em' : '0.75em'};
//                     color: ${isHour ? '#333' : '#666'};
//                     border-right: 1px solid #e0e0e0;
//                     border-bottom: 1px solid #e0e0e0;
//                     background-color: ${isHour ? '#f5f5f5' : '#fafafa'};
//                     box-sizing: border-box;
//                     text-align: center;
//                     flex-shrink: 0;
//                 ">
//                     ${isHour ? `${hour}:${minutes} ${ampm}` : `:${minutes}`}
//                 </div>
//             `;
//         }

//         // Events row with free slot indicators
//         let eventsHtml = '';
//         events.forEach((event, index) => {
//             if (event.endHour <= day_start_hour || event.startHour >= day_end_hour) {
//                 return;
//             }

//             const startHour = Math.max(event.startHour, day_start_hour);
//             const endHour = Math.min(event.endHour, day_end_hour);
//             const left = (startHour - day_start_hour) * HOURLY_SLOT_WIDTH_PX;
//             const width = (endHour - startHour) * HOURLY_SLOT_WIDTH_PX;

//             eventsHtml += `
//                 <div class="event" 
//                      role="button" 
//                      tabindex="0" 
//                      aria-label="${event.title} from ${event.displayStartTime} to ${event.displayEndTime}"
//                      style="
//                         position: absolute;
//                         top: 4px;
//                         bottom: 4px;
//                         left: ${left}px;
//                         width: ${width}px;
//                         margin: 0 2px;
//                         background: linear-gradient(135deg, ${event.color || '#e74c3c'}, ${event.color ? darkenColor(event.color, 20) : '#c0392b'});
//                         color: white;
//                         border-radius: 6px;
//                         padding: 6px 8px;
//                         font-size: 0.85em;
//                         box-shadow: 0 2px 4px rgba(0,0,0,0.15);
//                         overflow: hidden;
//                         white-space: nowrap;
//                         text-overflow: ellipsis;
//                         cursor: pointer;
//                         transition: transform 0.2s, box-shadow 0.2s;
//                      "
//                      onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'; this.querySelector('.tooltip').style.visibility='visible';"
//                      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.15)'; this.querySelector('.tooltip').style.visibility='hidden';">
//                     <div style="font-weight: 600;">${event.title}</div>
//                     <div style="font-size: 0.75em; opacity: 0.9;">
//                         ${event.displayStartTime} - ${event.displayEndTime}
//                     </div>
//                     <div class="tooltip" style="
//                         visibility: hidden;
//                         position: absolute;
//                         top: -50px;
//                         left: 50%;
//                         transform: translateX(-50%);
//                         background-color: #2c3e50;
//                         color: white;
//                         padding: 6px 10px;
//                         border-radius: 4px;
//                         font-size: 0.8em;
//                         z-index: 10;
//                         box-shadow: 0 2px 4px rgba(0,0,0,0.2);
//                         white-space: nowrap;
//                     ">
//                         ${event.attendee} (${event.type})
//                     </div>
//                 </div>
//             `;
//         });

//         // Add free slot indicators
//         const freeSlots = frm.events.calculate_free_slots(events, day_start_hour, day_end_hour);
//         freeSlots.forEach(slot => {
//             const left = (slot.start - day_start_hour) * HOURLY_SLOT_WIDTH_PX;
//             const width = (slot.end - slot.start) * HOURLY_SLOT_WIDTH_PX;
//             eventsHtml += `
//                 <div class="free-slot" style="
//                     position: absolute;
//                     top: 4px;
//                     bottom: 4px;
//                     left: ${left}px;
//                     width: ${width}px;
//                     margin: 0 2px;
//                     background-color: rgba(46, 204, 113, 0.2);
//                     border: 2px dashed #2ecc71;
//                     border-radius: 6px;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: 0.85em;
//                     color: #2ecc71;
//                     font-weight: 500;
//                     cursor: default;
//                 ">
//                     Free
//                 </div>
//             `;
//         });

//         return `
//             <style>
//                 .schedule-container {
//                     width: 100%;
//                     max-width: ${MAX_CONTAINER_WIDTH}px;
//                     margin: 0 auto;
//                     border: 1px solid #d0d0d0;
//                     border-radius: 8px;
//                     background: linear-gradient(to bottom, #ffffff, #f8f9fa);
//                     box-shadow: 0 4px 12px rgba(0,0,0,0.1);
//                     font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
//                     overflow: hidden;
//                 }
//                 .schedule-container header {
//                     padding: 12px 16px;
//                     background: #f1f3f5;
//                     border-bottom: 1px solid #d0d0d0;
//                     font-weight: 600;
//                     font-size: 1.1em;
//                     color: #2c3e50;
//                 }
//                 .schedule-grid {
//                     display: flex;
//                     flex-direction: column;
//                     background: repeating-linear-gradient(
//                         to right,
//                         #e0e0e0,
//                         #e0e0e0 1px,
//                         transparent 1px,
//                         transparent ${HALF_HOURLY_SLOT_WIDTH_PX}px
//                     );
//                 }
//                 .time-row {
//                     display: flex;
//                     flex-wrap: nowrap;
//                     border-bottom: 1px solid #d0d0d0;
//                 }
//                 .events-row {
//                     position: relative;
//                     height: 120px;
//                     overflow: hidden;
//                 }
//                 @media (max-width: ${MAX_CONTAINER_WIDTH}px) {
//                     .time-slot {
//                         width: ${HALF_HOURLY_SLOT_WIDTH_PX * 0.8}px !important;
//                         font-size: ${0.75 * 0.9}em !important;
//                     }
//                     .event, .free-slot {
//                         font-size: 0.75em !important;
//                         padding: 4px 6px !important;
//                     }
//                     .schedule-container header {
//                         font-size: 1em;
//                     }
//                     .tooltip {
//                         font-size: 0.7em !important;
//                         padding: 4px 8px !important;
//                     }
//                 }
//             </style>
//             <div class="schedule-container">
//                 <header>
//                     ${moment(frm.doc.interview_date).format('dddd, MMMM DD, YYYY')}
//                 </header>
//                 <div class="schedule-grid">
//                     <div class="time-row">
//                         ${timeSlotsHtml}
//                     </div>
//                     <div class="events-row">
//                         ${eventsHtml}
//                     </div>
//                 </div>
//             </div>
//         `;
//     },

//     calculate_free_slots: function(events, day_start_hour, day_end_hour) {
//         const slots = [];
//         let currentHour = day_start_hour;

//         const sortedEvents = events
//             .filter(e => e.endHour > day_start_hour && e.startHour < day_end_hour)
//             .sort((a, b) => a.startHour - b.startHour);

//         sortedEvents.forEach(event => {
//             const start = Math.max(event.startHour, day_start_hour);
//             if (currentHour < start) {
//                 slots.push({ start: currentHour, end: start });
//             }
//             currentHour = Math.max(currentHour, event.endHour);
//         });

//         if (currentHour < day_end_hour) {
//             slots.push({ start: currentHour, end: day_end_hour });
//         }

//         return slots;
//     }
// });

// // Helper function to darken color for gradient
// function darkenColor(hex, percent) {
//     let color = hex.replace('#', '');
//     let r = parseInt(color.substr(0, 2), 16);
//     let g = parseInt(color.substr(2, 2), 16);
//     let b = parseInt(color.substr(4, 2), 16);
    
//     r = Math.round(r * (100 - percent) / 100);
//     g = Math.round(g * (100 - percent) / 100);
//     b = Math.round(b * (100 - percent) / 100);
    
//     r = r < 0 ? 0 : r;
//     g = g < 0 ? 0 : g;
//     b = b < 0 ? 0 : b;
    
//     return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0')}`;
// }

frappe.ui.form.on('Schedule interview', {
    refresh: function(frm) {
        frm.toggle_display('available_slots_section', false);
    },
after_save: function(frm) {
        // Ensure required fields are present
        if (!frm.doc.interviewer_email || !frm.doc.attendees || !frm.doc.interview_date || !frm.doc.start_time || !frm.doc.end_time) {
            frappe.msgprint(__('Please fill Interviewer Email, Interviewee Email, Date, Start Time and End Time.'));
            return;
        }

        // Build ISO datetime strings from date + time
        const startDateTime = moment(frm.doc.interview_date + " " + frm.doc.start_time).format("YYYY-MM-DDTHH:mm:ss");
        const endDateTime = moment(frm.doc.interview_date + " " + frm.doc.end_time).format("YYYY-MM-DDTHH:mm:ss");

        // Call the backend method
        frappe.call({
            method: "ms_calendar.api.msgraph.create_calendar_event",
            args: {
                event_title: frm.doc.event_title || "Interview",
                start_datetime: startDateTime,
                end_datetime: endDateTime,
                interviewer_email: frm.doc.interviewer_email,
                interviewee_email: frm.doc.attendees
            },
            freeze: true,
            freeze_message: __("Creating calendar event..."),
            callback: function(r) {
                if (r.message) {
                    frappe.msgprint({
                        title: __("Success"),
                        message: __("Interview scheduled successfully! Event ID: ") + r.message.event_id,
                        indicator: "green"
                    });
                }
            },
            error: function(err) {
                frappe.msgprint({
                    title: __("Error"),
                    message: __("Failed to create calendar event. Please check the console."),
                    indicator: "red"
                });
                console.error("Calendar Event Error:", err);
            }
        });
    },
    check_availability: function(frm) {
        if (!frm.doc.interviewer_email || !frm.doc.interview_date) {
            frappe.msgprint({
                title: __('Missing Information'),
                indicator: 'red',
                message: __('Please enter interviewer email and interview date.')
            });
            return;
        }

        frm.get_field('available_slots').$wrapper.html(`
            <div class="availability-loader">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <h5 class="mt-3">Checking availability...</h5>
                <p class="text-muted">We're checking ${frm.doc.interviewer_email}'s schedule for ${frm.doc.interview_date}</p>
            </div>
        `);
        frm.toggle_display('available_slots_section', true);

        frappe.call({
            method: 'ms_calendar.api.msgraph.get_schedule_free_slots',
            args: {
                interviewer_email: frm.doc.interviewer_email,
                interview_date: frm.doc.interview_date
            },
            callback: function(r) {
                if (r.message) {
                    const processedEvents = r.message.map(interval => {
                        const startUtc = moment.utc(interval.start.dateTime);
                        const endUtc = moment.utc(interval.end.dateTime);

                        const start = startUtc.local();
                        const end = endUtc.local();

                        return {
                            title: interval.subject || "Busy",
                            type: interval.location?.displayName || "Meeting",
                            attendee: interval.organizer?.emailAddress?.name || "Unknown",
                            startHour: start.hours() + start.minutes() / 60,
                            endHour: end.hours() + end.minutes() / 60,
                            displayStartTime: start.format("h:mm A"),
                            displayEndTime: end.format("h:mm A"),
                            color: '#e74c3c' // Red for busy slots
                        };
                    });
                    frm.events.display_schedule_design(frm, processedEvents);
                } else {
                    frm.get_field('available_slots').$wrapper.html(`
                        <div class="alert alert-danger d-flex align-items-center" role="alert">
                            <svg class="bi flex-shrink-0 me-2" width="24" height="24" role="img" aria-label="Danger:">
                                <use xlink:href="#exclamation-triangle-fill"/>
                            </svg>
                            <div>An error occurred while fetching availability.</div>
                        </div>
                    `);
                }
            }
        });
    },
    
    display_schedule_design: function(frm, events) {
        const scheduleHtml = frm.events.generate_schedule_html(frm, events);
        frm.get_field('available_slots').$wrapper.html(scheduleHtml);
        
        // Add event listeners after the HTML is rendered
        setTimeout(() => {
            $('.schedule-event').on('click', function() {
                const startTime = $(this).data('start');
                const endTime = $(this).data('end');
                const title = $(this).data('title');
                const attendee = $(this).data('attendee');
                const type = $(this).data('type');
                
                frappe.msgprint({
                    title: 'Event Details',
                    message: `
                        <div class="event-details">
                            <p><strong>${title}</strong></p>
                            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                            <p><strong>Attendee:</strong> ${attendee}</p>
                            <p><strong>Type:</strong> ${type}</p>
                        </div>
                    `
                });
            });
            
            // Add click handler for free slots
            $('.event-free').on('click', function() {
                const startTime = $(this).data('start');
                const endTime = $(this).data('end');
                
                frappe.msgprint({
                    title: 'Available Time Slot',
                    message: `
                        <div class="event-details">
                            <p><strong>Available Slot</strong></p>
                            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                            <p>This time slot is available for scheduling.</p>
                        </div>
                    `
                });
            });
        }, 100);
    },

    generate_schedule_html: function(frm, events) {
        const day_start_hour = 6;   // 6 AM
        const day_end_hour = 18;    // 6 PM
        const total_hours = day_end_hour - day_start_hour; // 12 hours
        const hours_per_screen = 12; // Show 12 hours on screen
        const HOUR_WIDTH_PX = 80; // Width of each hour column

        // Time labels row
        let timeSlotsHtml = '';
        for (let i = day_start_hour; i <= day_end_hour; i++) {
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            timeSlotsHtml += `
                <div class="time-slot-hour" style="width: ${HOUR_WIDTH_PX}px;">
                    <div class="hour-label">${hour} ${ampm}</div>
                    <div class="hour-line"></div>
                </div>
            `;
        }

        // Events row with free slot indicators
        let eventsHtml = '';
        events.forEach((event, index) => {
            if (event.endHour <= day_start_hour || event.startHour >= day_end_hour) {
                return;
            }

            const startHour = Math.max(event.startHour, day_start_hour);
            const endHour = Math.min(event.endHour, day_end_hour);
            const left = (startHour - day_start_hour) * HOUR_WIDTH_PX;
            const width = (endHour - startHour) * HOUR_WIDTH_PX;

            eventsHtml += `
                <div class="schedule-event event-busy" 
                     data-start="${event.displayStartTime}"
                     data-end="${event.displayEndTime}"
                     data-title="${event.title}"
                     data-attendee="${event.attendee}"
                     data-type="${event.type}"
                     style="left: ${left}px; width: ${width}px;">
                    <div class="event-content">
                        <div class="event-title">${event.title}</div>
                        <div class="event-time">${event.displayStartTime} - ${event.displayEndTime}</div>
                    </div>
                    <div class="event-tooltip">
                        <strong>${event.title}</strong><br>
                        ${event.displayStartTime} - ${event.displayEndTime}<br>
                        <em>${event.attendee} (${event.type})</em>
                    </div>
                </div>
            `;
        });

        // Add free slot indicators
        const freeSlots = frm.events.calculate_free_slots(events, day_start_hour, day_end_hour);
        freeSlots.forEach(slot => {
            const left = (slot.start - day_start_hour) * HOUR_WIDTH_PX;
            const width = (slot.end - slot.start) * HOUR_WIDTH_PX;
            
            if (width > 0) {
                const startFormatted = moment().hour(Math.floor(slot.start)).minute((slot.start % 1) * 60).format("h:mm A");
                const endFormatted = moment().hour(Math.floor(slot.end)).minute((slot.end % 1) * 60).format("h:mm A");
                
                eventsHtml += `
                    <div class="schedule-event event-free" 
                         data-start="${startFormatted}"
                         data-end="${endFormatted}"
                         style="left: ${left}px; width: ${width}px;">
                        <div class="event-content">
                            <div class="event-title">Available</div>
                            <div class="event-time">${startFormatted} - ${endFormatted}</div>
                        </div>
                        <div class="event-tooltip">
                            <strong>Available Slot</strong><br>
                            ${startFormatted} - ${endFormatted}
                        </div>
                    </div>
                `;
            }
        });

        return `
            <div class="professional-schedule-container">
                <div class="schedule-header">
                    <h4>${moment(frm.doc.interview_date).format('dddd, MMMM DD, YYYY')}</h4>
                    <p class="text-muted">Showing schedule for ${frm.doc.interviewer_email} (6 AM - 6 PM)</p>
                </div>
                
                <div class="schedule-legend">
                    <div class="legend-item">
                        <span class="legend-color busy"></span>
                        <span class="legend-text">Busy</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color free"></span>
                        <span class="legend-text">Available</span>
                    </div>
                </div>
                
                <div class="timeline-container">
                    <div class="time-scale">
                        ${timeSlotsHtml}
                    </div>
                    
                    <div class="schedule-timeline">
                        ${eventsHtml}
                    </div>
                </div>
                
                <div class="schedule-footer">
                    <p class="text-muted">Click on any time block to view details</p>
                </div>
            </div>
            
            <style>
                .professional-schedule-container {
                    width: 100%;
                    max-width: 1000px;
                    margin: 0 auto;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background: #ffffff;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
                    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
                    overflow: hidden;
                }
                
                .schedule-header {
                    padding: 1.25rem 1.5rem;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .schedule-header h4 {
                    margin: 0;
                    color: #2c3e50;
                    font-weight: 600;
                    font-size: 1.25rem;
                }
                
                .schedule-header p {
                    margin: 0.25rem 0 0 0;
                    font-size: 0.9rem;
                }
                
                .schedule-legend {
                    display: flex;
                    padding: 0.75rem 1.5rem;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    margin-right: 1.5rem;
                }
                
                .legend-color {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border-radius: 4px;
                    margin-right: 0.5rem;
                }
                
                .legend-color.busy {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                }
                
                .legend-color.free {
                    background: linear-gradient(135deg, rgba(46, 204, 113, 0.2), rgba(46, 204, 113, 0.3));
                    border: 2px dashed #2ecc71;
                }
                
                .legend-text {
                    font-size: 0.85rem;
                    color: #495057;
                }
                
                .timeline-container {
                    position: relative;
                    padding: 1rem 0;
                }
                
                .time-scale {
                    display: flex;
                    margin: 0 1rem;
                    border-bottom: 1px solid #e0e0e0;
                    position: relative;
                }
                
                .time-slot-hour {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                }
                
                .hour-label {
                    font-size: 0.8rem;
                    color: #6c757d;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }
                
                .hour-line {
                    width: 1px;
                    height: 20px;
                    background-color: #e0e0e0;
                }
                
                .schedule-timeline {
                    position: relative;
                    height: 120px;
                    margin: 0 1rem;
                    background: repeating-linear-gradient(
                        to right,
                        transparent,
                        transparent ${HOUR_WIDTH_PX - 1}px,
                        #f5f5f5 ${HOUR_WIDTH_PX - 1}px,
                        #f5f5f5 ${HOUR_WIDTH_PX}px
                    );
                }
                
                .schedule-event {
                    position: absolute;
                    top: 10px;
                    bottom: 10px;
                    border-radius: 6px;
                    padding: 8px;
                    font-size: 0.8rem;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .schedule-event:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10;
                }
                
                .event-busy {
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    color: white;
                }
                
                .event-free {
                    background: linear-gradient(135deg, rgba(46, 204, 113, 0.15), rgba(46, 204, 113, 0.25));
                    border: 2px dashed #27ae60;
                    color: #27ae60;
                }
                
                .event-content {
                    text-align: center;
                }
                
                .event-title {
                    font-weight: 600;
                    line-height: 1.2;
                    margin-bottom: 2px;
                    font-size: 0.75rem;
                }
                
                .event-time {
                    font-size: 0.7rem;
                    opacity: 0.9;
                    line-height: 1.2;
                }
                
                .event-free .event-time {
                    color: #219653;
                }
                
                .event-tooltip {
                    visibility: hidden;
                    position: absolute;
                    bottom: calc(100% + 10px);
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: #2c3e50;
                    color: white;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    max-width: 220px;
                    width: max-content;
                    text-align: center;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .schedule-event:hover .event-tooltip {
                    visibility: visible;
                    opacity: 1;
                }
                
                .schedule-footer {
                    padding: 0.75rem 1.5rem;
                    background-color: #f8f9fa;
                    border-top: 1px solid #e0e0e0;
                    text-align: center;
                    font-size: 0.85rem;
                }
                
                @media (max-width: 768px) {
                    .professional-schedule-container {
                        border-radius: 6px;
                        margin: 0 10px;
                    }
                    
                    .schedule-header {
                        padding: 1rem;
                    }
                    
                    .schedule-header h4 {
                        font-size: 1.1rem;
                    }
                    
                    .time-scale, .schedule-timeline {
                        margin: 0 0.5rem;
                    }
                    
                    .hour-label {
                        font-size: 0.7rem;
                    }
                    
                    .schedule-event {
                        padding: 6px;
                    }
                    
                    .event-title {
                        font-size: 0.7rem;
                    margin-bottom: 0;
                    overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    
                    .event-time {
                        display: none;
                    }
                }
            </style>
        `;
    },

    calculate_free_slots: function(events, day_start_hour, day_end_hour) {
        const slots = [];
        let currentHour = day_start_hour;

        const sortedEvents = events
            .filter(e => e.endHour > day_start_hour && e.startHour < day_end_hour)
            .sort((a, b) => a.startHour - b.startHour);

        sortedEvents.forEach(event => {
            const start = Math.max(event.startHour, day_start_hour);
            if (currentHour < start) {
                slots.push({ start: currentHour, end: start });
            }
            currentHour = Math.max(currentHour, event.endHour);
        });

        if (currentHour < day_end_hour) {
            slots.push({ start: currentHour, end: day_end_hour });
        }

        return slots;
    }
});