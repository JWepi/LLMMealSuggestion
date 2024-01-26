/* Plugin to modify the select box into a number selector */
(function ( $ ) {
 
	$.fn.numberselector = function() {
		var i = 0;
		return this.each(function() {
			

			//hide the select box
			$(this).hide();

			var selectedValue = $(this).val();

			var numberSelector = '<div class="numberselector" data-selectbox="' + $(this).attr("name") + '"><div class="numersrow">';
			$(this).find("option").each(function() {
				numberSelector+= "<span data-attr='"+ $(this).val();
				if($(this).val() == selectedValue) {
					numberSelector+="' class='selected";
					if($('.q2-topbar').length){
						numberSelector+=' oldselection'
					}
				}
				numberSelector+= "'>" + $(this).val() + "</span>"
			});

			numberSelector+="</div></div>";

			$(numberSelector).insertAfter($(this));

			if(i == 0) {
				$("body").on('click', '.numberselector span', function() {
					var selectboxName = $(this).closest(".numberselector").attr("data-selectbox"),
						selectedVal = $(this).attr('data-attr');
					$(this).parent().find("span").removeClass("selected");
					$(this).addClass("selected");
					$(this).parents().find("select[name='"+selectboxName+"']").val(selectedVal).trigger("change");
				});
			}
			i++;
		});
	}

	

}( jQuery ));
