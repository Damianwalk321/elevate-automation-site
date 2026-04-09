
(() => {
  const NS = (window.ElevateDashboard = window.ElevateDashboard || {});
  if (NS.modules?.listings) return;
  function clean(value){ return String(value || "").replace(/\s+/g," ").trim(); }
  function numberFromText(value){ const m=String(value || "").replace(/,/g,"").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; }
  function minutesSince(iso){ if(!iso) return Infinity; const ts=new Date(iso).getTime(); if(!Number.isFinite(ts)) return Infinity; return Math.max(0, Math.round((Date.now()-ts)/60000)); }
  function hoursSince(iso){ return Math.round(minutesSince(iso)/60); }
  function inferHealth(item, events=[]){
    const views=Number(item.views||0), messages=Number(item.messages||0), status=clean(item.status).toLowerCase();
    const previousPrice=clean(item.previous_price||""), currentPrice=clean(item.current_price||item.price||"");
    const hasRecentViewLift=events.some(evt=>evt.type==="view_update" && Number(evt.meta?.delta||0)>=5 && minutesSince(evt.timestamp)<=240);
    const hasRecentMessageLift=events.some(evt=>evt.type==="message_update" && Number(evt.meta?.delta||0)>=1 && minutesSince(evt.timestamp)<=240);
    const recentPriceChange=events.some(evt=>evt.type==="price_changed" && minutesSince(evt.timestamp)<=1440);
    const lastSeenMins=minutesSince(item.last_seen_at), lastMessageMins=minutesSince(item.last_message_at), lastViewMins=minutesSince(item.last_view_at);
    if(status.includes("removed")) return "removed";
    if(status.includes("sold")) return "sold";
    if(hasRecentMessageLift && messages>=2) return "fresh_traction";
    if(messages>=3) return "message_leader";
    if(views>=25 && messages===0) return "high_views_low_messages";
    if(views>=12 && messages<=1) return "weak_conversion";
    if(recentPriceChange || (previousPrice && currentPrice && previousPrice!==currentPrice)) return "price_attention";
    if(lastSeenMins>240 && views>0 && !hasRecentViewLift && !hasRecentMessageLift) return "needs_refresh";
    if(lastViewMins>480 && lastMessageMins>480 && views>0) return "cooling_off";
    if(views===0 && messages===0) return "low_signal";
    if(lastMessageMins<=180) return "high_interest";
    if(lastViewMins<=180) return "view_leader";
    return "active";
  }
  function confidenceFor(item){ if(item.sync_confidence) return item.sync_confidence; if(item.source==="recent_listings_grid") return "tracked"; if(item.source==="summary_fallback") return "estimated"; return "mixed"; }
  function readListingCardsFromDOM(){
    const cards=Array.from(document.querySelectorAll("#recentListingsGrid .listing-card"));
    return cards.map((card,idx)=>{ const title=clean(card.querySelector(".listing-title")?.textContent || `Listing ${idx+1}`); const price=clean(card.querySelector(".listing-price")?.textContent || ""); const specs=Array.from(card.querySelectorAll(".spec-chip, .metric-pill")).map(el=>clean(el.textContent)); const textBlob=clean(card.textContent || ""); const views=numberFromText(specs.find(s=>/view/i.test(s)) || (textBlob.match(/views?\s*:?\s*([\d,]+)/i)||[])[1] || 0); const messages=numberFromText(specs.find(s=>/message/i.test(s)) || (textBlob.match(/messages?\s*:?\s*([\d,]+)/i)||[])[1] || 0); const image=card.querySelector("img")?.getAttribute("src") || ""; return {id:clean(card.dataset.listingId || title || `listing_${idx}`),title,price,current_price:price,views,messages,image_url:image,source:"recent_listings_grid",status:"active",last_seen_at:new Date().toISOString()}; });
  }
  function readSummaryFallback(){
    const summary=window.dashboardSummary || {}; const activeListings=Number(summary.active_listings||0), totalViews=Number(summary.views||0), totalMessages=Number(summary.messages||0), items=[];
    if(!activeListings) return items;
    const avgViews=Math.round(totalViews/Math.max(activeListings,1)), avgMessages=Math.round(totalMessages/Math.max(activeListings,1));
    for(let i=0;i<Math.min(activeListings,5);i+=1){ items.push({id:`summary_listing_${i+1}`,title:`Tracked Listing ${i+1}`,price:"",current_price:"",views:avgViews,messages:avgMessages,source:"summary_fallback",status:"active",last_seen_at:new Date().toISOString()}); }
    return items;
  }
  function getRemoteSnapshot(){
    const summary=window.dashboardSummary || {}, sessionPayload=window.currentAccountData || {}, profilePayload=window.currentNormalizedSession || {};
    const remoteListings=summary.listing_feed || summary.synced_listings || sessionPayload.listing_feed || profilePayload.listing_feed || [];
    const remoteEvents=summary.listing_events || sessionPayload.listing_events || profilePayload.listing_events || [];
    const removed=summary.removed_listing_ids || sessionPayload.removed_listing_ids || [];
    const confidence=summary.sync_confidence || sessionPayload.sync_confidence || ((remoteListings.length || remoteEvents.length) ? "synced" : "local");
    const source=summary.sync_source || sessionPayload.sync_source || ((remoteListings.length || remoteEvents.length) ? "dashboard_summary" : "local");
    const issues=summary.sync_issues || sessionPayload.sync_issues || [];
    return {source,confidence,listings:Array.isArray(remoteListings)?remoteListings:[],events:Array.isArray(remoteEvents)?remoteEvents:[],removed_listing_ids:Array.isArray(removed)?removed:[],issues:Array.isArray(issues)?issues:[]};
  }
  function eventCounts(events, type){ return events.filter(evt=>evt.type===type).length; }
  function buildAnalyticsFromRegistry(){
    const listings=Object.values(NS.state?.get?.("listingRegistry",{}) || {}).filter(item=>clean(item.status).toLowerCase()!=="removed");
    const events=NS.state?.get?.("listingEvents",[]) || []; const sync=NS.state?.get?.("sync",{}) || {};
    const sortedByViews=[...listings].sort((a,b)=>Number(b.views||0)-Number(a.views||0)); const sortedByMessages=[...listings].sort((a,b)=>Number(b.messages||0)-Number(a.messages||0));
    const buckets={
      message_leaders:listings.filter(item=>item.health_state==="message_leader").slice(0,5),
      view_leaders:listings.filter(item=>item.health_state==="view_leader").slice(0,5),
      high_interest:listings.filter(item=>item.health_state==="high_interest").slice(0,5),
      high_views_low_messages:listings.filter(item=>item.health_state==="high_views_low_messages").slice(0,5),
      weak_conversion:listings.filter(item=>item.health_state==="weak_conversion").slice(0,5),
      fresh_traction:listings.filter(item=>item.health_state==="fresh_traction").slice(0,5),
      needs_refresh:listings.filter(item=>item.health_state==="needs_refresh").slice(0,5),
      price_attention:listings.filter(item=>item.health_state==="price_attention").slice(0,5),
      cooling_off:listings.filter(item=>item.health_state==="cooling_off").slice(0,5),
      recovered:listings.filter(item=>{ const listingEvents=NS.state?.getListingEvents?.(item.id)||[]; return listingEvents.some(evt=>evt.type==="price_changed") && listingEvents.some(evt=>evt.type==="message_update"); }).slice(0,5)
    };
    const trackedViews=listings.reduce((sum,item)=>sum+Number(item.views||0),0), trackedMessages=listings.reduce((sum,item)=>sum+Number(item.messages||0),0), actionQueue=[];
    if(buckets.high_views_low_messages.length){ const leader=buckets.high_views_low_messages[0]; actionQueue.push({id:"high_views_low_messages",title:`${buckets.high_views_low_messages.length} listing${buckets.high_views_low_messages.length===1?"":"s"} have traction without conversion`,copy:`${leader.title||"Top listing"} has ${leader.views||0} views and ${leader.messages||0} messages. Review price, CTA, and media first.`,tone:"revenue",section:"tools",focus:"listingSearchInput",reason:"Strong attention, weak buyer response."}); }
    if(buckets.fresh_traction.length){ const leader=buckets.fresh_traction[0]; actionQueue.push({id:"fresh_traction",title:`${buckets.fresh_traction.length} listing${buckets.fresh_traction.length===1?"":"s"} have fresh traction`,copy:`${leader.title||"Top listing"} has recent message lift. Promote, repost, or move it to the front of current focus.`,tone:"growth",section:"overview",focus:"listingSearchInput",reason:"Recent message gain detected."}); }
    if(buckets.price_attention.length){ const leader=buckets.price_attention[0]; actionQueue.push({id:"price_attention",title:`${buckets.price_attention.length} listing${buckets.price_attention.length===1?"":"s"} need price attention`,copy:`${leader.title||"A listing"} changed price. Check whether traction improved or if more intervention is needed.`,tone:"cleanup",section:"tools",focus:"listingSearchInput",reason:"Price moved, follow-through signal needs review."}); }
    if(buckets.cooling_off.length){ const leader=buckets.cooling_off[0]; actionQueue.push({id:"cooling_off",title:`${buckets.cooling_off.length} listing${buckets.cooling_off.length===1?"":"s"} are cooling off`,copy:`${leader.title||"A listing"} has gone quiet. Refresh media, copy, or repost timing.`,tone:"cleanup",section:"overview",focus:"listingSearchInput",reason:"No recent signal in the active window."}); }
    if(!actionQueue.length){ actionQueue.push({id:"sync_truth_quiet",title:"Sync truth layer is live",copy:"As synced listing payloads and events grow, this queue will become more authoritative and more valuable.",tone:"growth",section:"tools",focus:null,reason:"Current session is stable."}); }
    const payload={tracking_summary:{total_listings:listings.length,tracked_views:trackedViews,tracked_messages:trackedMessages,message_leaders_count:buckets.message_leaders.length || sortedByMessages.filter(item=>Number(item.messages||0)>0).length,view_leaders_count:buckets.view_leaders.length || sortedByViews.filter(item=>Number(item.views||0)>0).length,high_interest_count:buckets.high_interest.length,high_views_low_messages_count:buckets.high_views_low_messages.length,weak_conversion_count:buckets.weak_conversion.length,fresh_traction_count:buckets.fresh_traction.length,needs_refresh_count:buckets.needs_refresh.length,price_attention_count:buckets.price_attention.length,cooling_off_count:buckets.cooling_off.length,recovered_count:buckets.recovered.length,listing_seen_events:eventCounts(events,"listing_seen"),view_update_events:eventCounts(events,"view_update"),message_update_events:eventCounts(events,"message_update"),price_changed_events:eventCounts(events,"price_changed"),listing_removed_events:eventCounts(events,"listing_removed"),sync_source:sync.source||"local_only",sync_confidence:sync.confidence||"local",sync_remote_listing_count:Number(sync.remote_listing_count||0),sync_remote_event_count:Number(sync.remote_event_count||0),sync_issues_count:Array.isArray(sync.issues)?sync.issues.length:0,refreshed_at:new Date().toISOString()},action_queue:actionQueue,leaders:buckets};
    NS.state?.setAnalytics?.(payload,{silent:false}); NS.state?.set?.("tracking.last_rebuild_at",payload.tracking_summary.refreshed_at,{silent:true}); NS.state?.set?.("tracking.source","bundle_d_sync_truth",{silent:true,skipPersist:false}); return payload;
  }
  function reconcileRegistry(){
    const registry=Object.values(NS.state?.get?.("listingRegistry",{}) || {});
    registry.forEach(item=>{ const listingEvents=NS.state?.getListingEvents?.(item.id) || []; item.health_state=inferHealth(item,listingEvents); item.confidence=confidenceFor(item); item.time_since_seen_hours=hoursSince(item.last_seen_at); item.time_since_view_hours=hoursSince(item.last_view_at); item.time_since_message_hours=hoursSince(item.last_message_at); NS.state.upsertListing(item,{silent:true,skipEvents:true,skipPersist:true}); });
    NS.state?.rebuildFilteredListings?.();
  }
  function rebuildRegistry(){
    if(!NS.state?.upsertListing) return;
    const remote=getRemoteSnapshot(); const currentIds=[];
    if((remote.listings||[]).length || (remote.events||[]).length || (remote.removed_listing_ids||[]).length){ NS.state?.ingestSyncedSnapshot?.(remote,{silent:true}); }
    else {
      let items=readListingCardsFromDOM(); if(!items.length) items=readSummaryFallback();
      items.forEach((item,idx)=>{ const next={...item}; if(!next.id) next.id=`${next.title||"listing"}_${idx+1}`; const upserted=NS.state.upsertListing(next,{silent:true}); currentIds.push(upserted.id); });
      NS.state?.markMissingListingsRemoved?.(currentIds,{skipPersist:false});
      NS.state?.setSync?.({source:"local_dom",confidence:items.length?"tracked":"estimated",last_ingest_at:new Date().toISOString(),remote_payload_seen:false,remote_listing_count:0,remote_event_count:0,issues:items.length?[]:["No remote payload found; using local DOM snapshot fallback."]},{silent:true,skipPersist:false});
    }
    reconcileRegistry(); return buildAnalyticsFromRegistry();
  }
  function bindRefresh(){ const btn=document.getElementById("refreshListingsBtn"); if(!btn || btn.dataset.bundleDBound==="true") return; btn.dataset.bundleDBound="true"; btn.addEventListener("click",()=>{ rebuildRegistry(); window.dispatchEvent(new CustomEvent("elevate:tracking-refreshed")); window.dispatchEvent(new CustomEvent("elevate:sync-refreshed")); }); }
  function boot(){ rebuildRegistry(); bindRefresh(); setTimeout(rebuildRegistry,1200); setTimeout(rebuildRegistry,3200); }
  NS.listings={rebuildRegistry,buildAnalyticsFromRegistry,getRemoteSnapshot};
  NS.modules = NS.modules || {}; NS.modules.listings = true;
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
})();
