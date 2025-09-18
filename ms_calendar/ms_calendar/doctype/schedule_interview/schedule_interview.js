frappe.ui.form.on('Schedule interview', {
    refresh: function(frm) {
        frm.toggle_display('available_slots_section', false);
    },

    after_save: function(frm) {
        if (!frm.doc.interviewer_email || !frm.doc.attendees || !frm.doc.interview_date || !frm.doc.start_time || !frm.doc.end_time) {
            frappe.msgprint(__('Please fill Interviewer Email, Interviewee Email, Date, Start Time and End Time.'));
            return;
        }
        const startDateTime = moment(frm.doc.interview_date + " " + frm.doc.start_time).format("YYYY-MM-DDTHH:mm:ss");
        const endDateTime = moment(frm.doc.interview_date + " " + frm.doc.end_time).format("YYYY-MM-DDTHH:mm:ss");

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
    interview_date: function(frm) {
        const today = moment().startOf('day');
        const interviewDate = moment(frm.doc.interview_date, "YYYY-MM-DD");

        if (interviewDate.isBefore(today)) {
            frappe.msgprint(__('Interview Date cannot be in the past.'));
            frm.set_value('interview_date', null); // reset the field
        }
    },

   start_time: function(frm) {
    if (frm.doc.end_time && frm.doc.start_time) {
        const startDateTime = moment(frm.doc.interview_date + " " + frm.doc.start_time);
        const endDateTime = moment(frm.doc.interview_date + " " + frm.doc.end_time);

        if (startDateTime.isAfter(endDateTime)) {
            frappe.msgprint(__('Start Time must be less than End Time.'));
            frm.set_value('start_time', null); 
        }
    }
},

    end_time: function(frm) {
        if (frm.doc.start_time && frm.doc.end_time) {
            const startDateTime = moment(frm.doc.interview_date + " " + frm.doc.start_time);
            const endDateTime = moment(frm.doc.interview_date + " " + frm.doc.end_time);
            if (endDateTime.isBefore(startDateTime)) {
                frappe.msgprint(__('End Time must be greater than Start Time.'));
                frm.set_value('end_time', null); 
            }
        }
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
                            color: '#e74c3c'
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
                            <p><strong>${title ? title : "Free Slot"}</strong></p>
                            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                            ${title ? `<p><strong>Type:</strong> ${type}</p>` : ""}
                        </div>
                    `
                });

            });
            
            $('.event-free').on('click', function() {
                const startTime = $(this).data('start');
                const endTime = $(this).data('end');
                
                frappe.msgprint({
                    title: 'Available Time Slot',
                    message: `
                        <div class="event-details">
                            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                            <p>This time slot is available for scheduling.</p>
                        </div>
                    `
                });
            });
        }, 100);
    },

    generate_schedule_html: function(frm, events) {
        const day_start_hour = 8;      // Changed from 6 to 8 AM
        const day_end_hour = 18;       // 6 PM (18:00 in 24h format)
        const total_hours = day_end_hour - day_start_hour; // 10 hours
        const SLOT_WIDTH_PX = 80;      // Width for each 30-minute slot
        
        // Generate time labels with 30-minute intervals
        let timeSlotsHtml = '';
        for (let i = day_start_hour; i < day_end_hour; i++) {
            // Full hour
            const hour = i % 12 === 0 ? 12 : i % 12;
            const ampm = i < 12 ? 'AM' : 'PM';
            
            // Add full hour slot
            timeSlotsHtml += `
                <div class="time-slot-group" style="width: ${SLOT_WIDTH_PX * 2}px;">
                    <div class="time-slot-hour">
                        <div class="hour-label major">${hour}:00 ${ampm}</div>
                        <div class="hour-line major"></div>
                    </div>
                    <div class="time-slot-half">
                        <div class="hour-label minor">${hour}:30</div>
                        <div class="hour-line minor"></div>
                    </div>
                </div>
            `;
        }
        
        // Add final hour marker
        const finalHour = day_end_hour % 12 === 0 ? 12 : day_end_hour % 12;
        const finalAmpm = day_end_hour < 12 ? 'AM' : 'PM';
        timeSlotsHtml += `
            <div class="time-slot-final" style="width: ${SLOT_WIDTH_PX}px;">
                <div class="hour-label major">${finalHour}:00 ${finalAmpm}</div>
                <div class="hour-line major"></div>
            </div>
        `;

        // Generate events HTML
        let eventsHtml = '';
        events.forEach((event, index) => {
            if (event.endHour <= day_start_hour || event.startHour >= day_end_hour) {
                return;
            }

            const startHour = Math.max(event.startHour, day_start_hour);
            const endHour = Math.min(event.endHour, day_end_hour);
            
            // Calculate position and width based on 30-minute slots
            const leftPercentage = ((startHour - day_start_hour) / total_hours) * 100;
            const widthPercentage = ((endHour - startHour) / total_hours) * 100;

            eventsHtml += `
                <div class="schedule-event event-busy" 
                     data-start="${event.displayStartTime}"
                     data-end="${event.displayEndTime}"
                     data-title="${event.title}"
                     data-attendee="${event.attendee}"
                     data-type="${event.type}"
                     style="left: ${leftPercentage}%; width: ${widthPercentage}%;">
                    <div class="event-content">
                        <div class="event-title">${event.title}</div>
                        <div class="event-time">${event.displayStartTime} - ${event.displayEndTime}</div>
                    </div>
                    <div class="event-tooltip">
                        <strong>${event.title}</strong><br>
                        ${event.displayStartTime} - ${event.displayEndTime}<br>
                        <em>(${event.type})</em>
                    </div>
                </div>
            `;
        });

        // Generate free slots
        const freeSlots = frm.events.calculate_free_slots(events, day_start_hour, day_end_hour);
        freeSlots.forEach(slot => {
            const leftPercentage = ((slot.start - day_start_hour) / total_hours) * 100;
            const widthPercentage = ((slot.end - slot.start) / total_hours) * 100;
            
            if (widthPercentage > 0) {
                const startFormatted = moment().hour(Math.floor(slot.start)).minute((slot.start % 1) * 60).format("h:mm A");
                const endFormatted = moment().hour(Math.floor(slot.end)).minute((slot.end % 1) * 60).format("h:mm A");
                
                eventsHtml += `
                    <div class="schedule-event event-free" 
                         data-start="${startFormatted}"
                         data-end="${endFormatted}"
                         style="left: ${leftPercentage}%; width: ${widthPercentage}%;">
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
            <div class="schedule-container">
                <div class="schedule-header">
                 <div class="header-content">
                        <div class="date-section">
                            <h2 class="schedule-date">${moment(frm.doc.interview_date).format('dddd, MMMM DD, YYYY')}</h2>
                        </div>
                        <div class="email-info">
                            <span class="email-label">Calendar Events for</span>
                            <span class="email-address">${frm.doc.interviewer_email}</span>
                        </div>
                    </div>
                </div>
                
                <div class="schedule-legend">
                    <div class="legend-items">
                        <div class="legend-item">
                            <div class="legend-dot busy"></div>
                            <span>Busy</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot available"></div>
                            <span>Available</span>
                        </div>
                    </div>
                </div>
                
                <div class="timeline-section">
                    <div class="time-labels">
                        ${timeSlotsHtml}
                    </div>
                    
                    <div class="timeline-grid">
                        <div class="timeline-track">
                            </div>
                        ${eventsHtml}
                    </div>
                </div>
                
                <div class="schedule-footer">
                    <div class="footer-stats">
                        
                    </div>
                </div>
            </div>
            
            <style>
                .schedule-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }
                
                .schedule-header {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                }
                
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                
                .date-section {
                    flex: 1;
                }
                
                .schedule-date {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0 0 0.5rem 0;
                    letter-spacing: -0.025em;
                }
                
                .email-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                }
                
                .email-label {
                    color: #64748b;
                    font-size: 0.75rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                .email-address {
                    color: #374151;
                    font-size: 0.875rem;
                    font-weight: 600;
                    font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
                }
                
                .schedule-legend {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem 1rem;
                    background: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .legend-items {
                    display: flex;
                    gap: 1.5rem;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.75rem;
                    color: #475569;
                }
                
                .legend-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 3px;
                }
                
                .legend-dot.busy {
                    background: #f87171;
                    border: 1px solid #f87171;
                }
                
                .legend-dot.available {
                    background: #6ee7b7;
                    border: 1px solid #6ee7b7;
                }
                
                .timezone {
                    font-size: 0.75rem;
                    color: #64748b;
                }
                
                .timeline-section {
                    padding: 1rem;
                    overflow-x: auto;
                }
                
                .time-labels {
                    display: flex;
                    margin-bottom: 0.5rem;
                    min-width: 800px;
                }
                
                .time-slot-group, .time-slot-final {
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }
                
                .time-slot-group {
                    justify-content: space-between;
                }
                
                .time-slot-hour, .time-slot-half {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                    gap: 0.2rem;
                }
                
                .time-slot-final {
                    align-items: center;
                    gap: 0.2rem;
                }
                
                .hour-label {
                    font-size: 0.65rem;
                    color: #64748b;
                    text-align: center;
                }
                
                .hour-label.major {
                    font-weight: 600;
                    color: #374151;
                    font-size: 0.7rem;
                }
                
                .hour-label.minor {
                    font-weight: 500;
                    color: #6b7280;
                    font-size: 0.6rem;
                }
                
                .hour-line {
                    width: 1px;
                    height: 10px;
                }
                
                .hour-line.major {
                    background: #374151;
                    height: 14px;
                    width: 2px;
                }
                
                .hour-line.minor {
                    background: #6b7280;
                    height: 8px;
                    width: 1.5px;
                }
                
                .timeline-grid {
                    position: relative;
                    height: 80px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #ffffff;
                    min-width: 800px;
                }
                
                .timeline-track {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: repeating-linear-gradient(
                        to right,
                        transparent 0%,
                        transparent 4.9%,
                        rgba(107, 114, 128, 0.3) 4.9%,
                        rgba(107, 114, 128, 0.3) 5%,
                        transparent 5%,
                        transparent 9.9%,
                        rgba(55, 65, 81, 0.4) 9.9%,
                        rgba(55, 65, 81, 0.4) 10%
                    );
                }
                
                .schedule-event {
                    position: absolute;
                    top: 6px;
                    bottom: 6px;
                    border-radius: 6px;
                    padding: 0.3rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 50px;
                    z-index: 2;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }
                
                .schedule-event:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
                    z-index: 10;
                }
                
                .event-busy {
                    background: linear-gradient(135deg, #f87171, #fb7185) !important;
                    color: white !important;
                    border: 1px solid #f87171 !important;
                }
                
                .event-busy:hover {
                    background: linear-gradient(135deg, #fb7185, #f87171) !important;
                }
                
                .event-free {
                    background: linear-gradient(135deg, #6ee7b7, #34d399) !important;
                    color: white !important;
                    border: 1px solid #6ee7b7 !important;
                }
                
                .event-free:hover {
                    background: linear-gradient(135deg, #34d399, #6ee7b7) !important;
                }
                
                .event-content {
                    text-align: center;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .event-title {
                    font-weight: 600;
                    font-size: 0.6rem;
                    line-height: 1.1;
                    margin-bottom: 0.1rem;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .event-time {
                    font-size: 0.55rem;
                    opacity: 0.9;
                    line-height: 1.1;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .event-tooltip {
                    visibility: hidden;
                    position: absolute;
                    bottom: calc(100% + 8px);
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1f2937;
                    color: white;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    z-index: 1000;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
                    white-space: nowrap;
                    opacity: 0;
                    transition: all 0.3s ease;
                }
                
                .event-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 5px solid transparent;
                    border-top-color: #1f2937;
                }
                
                .schedule-event:hover .event-tooltip {
                    visibility: visible;
                    opacity: 1;
                }
                
                .schedule-footer {
                    padding: 1rem;
                    background: #f8fafc;
                    border-top: 1px solid #e2e8f0;
                }
                
                .footer-stats {
                    display: flex;
                    gap: 2rem;
                }
                
                .stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.2rem;
                }
                
                .stat-number {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #1e293b;
                }
                
                .stat-label {
                    font-size: 0.65rem;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                
                @media (max-width: 768px) {
                    .schedule-container {
                        border-radius: 6px;
                    }
                    
                    .schedule-header {
                        padding: 0.75rem;
                    }
                    
                    .header-content {
                        flex-direction: column;
                        gap: 1rem;
                        align-items: flex-start;
                    }
                    
                    .schedule-date {
                        font-size: 1.1rem;
                    }
                    
                    .email-address {
                        font-size: 0.8rem;
                        word-break: break-all;
                    }
                    
                    .schedule-legend {
                        padding: 0.5rem 1rem;
                        flex-direction: column;
                        gap: 0.75rem;
                        align-items: flex-start;
                    }
                    
                    .timeline-section {
                        padding: 0.75rem;
                    }
                    
                    .hour-label.major {
                        font-size: 0.65rem;
                    }
                    
                    .hour-label.minor {
                        font-size: 0.6rem;
                    }
                    
                    .event {
                        padding: 0.3rem;
                    }
                    
                    .event-title {
                        font-size: 0.55rem;
                        margin-bottom: 0.1rem;
                    }
                    
                    .event-time {
                        font-size: 0.5rem;
                    }
                    
                    .footer-stats {
                        gap: 1.5rem;
                        justify-content: center;
                    }
                }
                
                @media (max-width: 480px) {
                    .hour-label.minor {
                        display: none;
                    }
                    
                    .event-title {
                        font-size: 0.5rem;
                    }
                    
                    .event-time {
                        font-size: 0.45rem;
                    }
                    
                    .footer-stats {
                        gap: 1rem;
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

// frappe.ui.form.on('Schedule interview', {
//     refresh: function(frm) {
//         frm.toggle_display('available_slots_section', false);
//     },

//     after_save: function(frm) {
//         if (!frm.doc.interviewer_email || !frm.doc.attendees || !frm.doc.interview_date || !frm.doc.start_time || !frm.doc.end_time) {
//             frappe.msgprint(__('Please fill Interviewer Email, Interviewee Email, Date, Start Time and End Time.'));
//             return;
//         }
//         const startDateTime = moment(frm.doc.interview_date + " " + frm.doc.start_time).format("YYYY-MM-DDTHH:mm:ss");
//         const endDateTime = moment(frm.doc.interview_date + " " + frm.doc.end_time).format("YYYY-MM-DDTHH:mm:ss");

//         frappe.call({
//             method: "ms_calendar.api.msgraph.create_calendar_event",
//             args: {
//                 event_title: frm.doc.event_title || "Interview",
//                 start_datetime: startDateTime,
//                 end_datetime: endDateTime,
//                 interviewer_email: frm.doc.interviewer_email,
//                 interviewee_email: frm.doc.attendees
//             },
//             freeze: true,
//             freeze_message: __("Creating calendar event..."),
//             callback: function(r) {
//                 if (r.message) {
//                     frappe.msgprint({
//                         title: __("Success"),
//                         message: __("Interview scheduled successfully! Event ID: ") + r.message.event_id,
//                         indicator: "green"
//                     });
//                 }
//             },
//             error: function(err) {
//                 frappe.msgprint({
//                     title: __("Error"),
//                     message: __("Failed to create calendar event. Please check the console."),
//                     indicator: "red"
//                 });
//                 console.error("Calendar Event Error:", err);
//             }
//         });
//     },

//     check_availability: function(frm) {
//         if (!frm.doc.interviewer_email || !frm.doc.interview_date) {
//             frappe.msgprint({
//                 title: __('Missing Information'),
//                 indicator: 'red',
//                 message: __('Please enter interviewer email and interview date.')
//             });
//             return;
//         }

//         frm.get_field('available_slots').$wrapper.html(`
//             <div class="availability-loader">
//                 <div class="spinner-border text-primary" role="status">
//                     <span class="sr-only">Loading...</span>
//                 </div>
//                 <h5 class="mt-3">Checking availability...</h5>
//                 <p class="text-muted">We're checking ${frm.doc.interviewer_email}'s schedule for ${frm.doc.interview_date}</p>
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
//                         };
//                     });
//                     frm.events.display_schedule_design(frm, processedEvents);
//                 } else {
//                     frm.get_field('available_slots').$wrapper.html(`
//                         <div class="alert alert-danger" role="alert">
//                             <strong>Error:</strong> Could not fetch availability.
//                         </div>
//                     `);
//                 }
//             }
//         });
//     },

//     display_schedule_design: function(frm, events) {
//         const scheduleHtml = frm.events.generate_schedule_html(frm, events);
//         frm.get_field('available_slots').$wrapper.html(scheduleHtml);

//         setTimeout(() => {
//             $('.schedule-event').on('click', function() {
//                 const startTime = $(this).data('start');
//                 const endTime = $(this).data('end');
//                 const title = $(this).data('title') || 'Available Slot';
//                 const attendee = $(this).data('attendee') || '';
//                 const type = $(this).data('type') || '';

//                 frappe.msgprint({
//                     title: title === 'Available Slot' ? 'Available Time Slot' : 'Event Details',
//                     message: `
//                         <div class="event-details">
//                             <p><strong>${title}</strong></p>
//                             <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
//                             ${attendee ? `<p><strong>Attendee:</strong> ${attendee}</p>` : ''}
//                             ${type ? `<p><strong>Type:</strong> ${type}</p>` : ''}
//                         </div>
//                     `
//                 });
//             });
//         }, 300);
//     },

//     generate_schedule_html: function(frm, events) {
//         const day_start_hour = 8;
//         const day_end_hour = 18;
//         const total_hours = day_end_hour - day_start_hour;

//         // Color mapping for events
//         const colorMap = {
//             "Meeting": "event-meeting",
//             "Call": "event-call",
//             "Interview": "event-interview",
//             "Busy": "event-busy",
//             "Default": "event-busy"
//         };

//         // Generate events HTML
//         let eventsHtml = '';
//         events.forEach(event => {
//             if (event.endHour <= day_start_hour || event.startHour >= day_end_hour) return;

//             const startHour = Math.max(event.startHour, day_start_hour);
//             const endHour = Math.min(event.endHour, day_end_hour);
//             const leftPercentage = ((startHour - day_start_hour) / total_hours) * 100;
//             const widthPercentage = ((endHour - startHour) / total_hours) * 100;

//             const cssClass = colorMap[event.type] || colorMap["Default"];

//             eventsHtml += `
//                 <div class="schedule-event ${cssClass}"
//                      data-start="${event.displayStartTime}"
//                      data-end="${event.displayEndTime}"
//                      data-title="${event.title}"
//                      data-attendee="${event.attendee}"
//                      data-type="${event.type}"
//                      style="left: ${leftPercentage}%; width: ${widthPercentage}%;">
//                     <div class="event-content">
//                         <div class="event-title">${event.title}</div>
//                         <div class="event-time">${event.displayStartTime} - ${event.displayEndTime}</div>
//                     </div>
//                     <div class="event-tooltip">
//                         <strong>${event.title}</strong><br>
//                         ${event.displayStartTime} - ${event.displayEndTime}<br>
//                         <em>${event.type}</em>
//                     </div>
//                 </div>
//             `;
//         });

//         // Free slots
//         const freeSlots = frm.events.calculate_free_slots(events, day_start_hour, day_end_hour);
//         freeSlots.forEach(slot => {
//             const leftPercentage = ((slot.start - day_start_hour) / total_hours) * 100;
//             const widthPercentage = ((slot.end - slot.start) / total_hours) * 100;
//             if (widthPercentage > 0) {
//                 const startFormatted = moment().hour(Math.floor(slot.start)).minute((slot.start % 1) * 60).format("h:mm A");
//                 const endFormatted = moment().hour(Math.floor(slot.end)).minute((slot.end % 1) * 60).format("h:mm A");

//                 eventsHtml += `
//                     <div class="schedule-event event-free"
//                          data-start="${startFormatted}"
//                          data-end="${endFormatted}"
//                          data-title="Available Slot"
//                          style="left: ${leftPercentage}%; width: ${widthPercentage}%;">
//                         <div class="event-content">
//                             <div class="event-title">Available</div>
//                             <div class="event-time">${startFormatted} - ${endFormatted}</div>
//                         </div>
//                         <div class="event-tooltip">
//                             <strong>Available Slot</strong><br>
//                             ${startFormatted} - ${endFormatted}
//                         </div>
//                     </div>
//                 `;
//             }
//         });

//         return `
//             <div class="schedule-container">
//                 <div class="timeline-grid">
//                     ${eventsHtml}
//                 </div>
//             </div>
//             <style>
//                 .schedule-event { position: absolute; top:6px; bottom:6px; border-radius:6px; padding:4px; cursor:pointer; }
//                 .event-tooltip { visibility:hidden; opacity:0; transition:all 0.3s ease; position:absolute; bottom:110%; left:50%; transform:translateX(-50%); background:#111; color:#fff; padding:6px 10px; border-radius:4px; white-space:nowrap; }
//                 .schedule-event:hover .event-tooltip { visibility:visible; opacity:1; }

//                 .event-busy { background:#ef4444; color:white; }
//                 .event-free { background:#10b981; color:white; }
//                 .event-meeting { background:#3b82f6; color:white; }
//                 .event-call { background:#f59e0b; color:white; }
//                 .event-interview { background:#8b5cf6; color:white; }
//             </style>
//         `;
//     },

//     calculate_free_slots: function(events, day_start_hour, day_end_hour) {
//         const slots = [];
//         let currentHour = day_start_hour;
//         const sortedEvents = events.filter(e => e.endHour > day_start_hour && e.startHour < day_end_hour)
//             .sort((a, b) => a.startHour - b.startHour);
//         sortedEvents.forEach(event => {
//             if (currentHour < event.startHour) {
//                 slots.push({ start: currentHour, end: event.startHour });
//             }
//             currentHour = Math.max(currentHour, event.endHour);
//         });
//         if (currentHour < day_end_hour) {
//             slots.push({ start: currentHour, end: day_end_hour });
//         }
//         return slots;
//     }
// });