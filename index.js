$(function () {
  "use strict";

  // type aimodel = "gpt" | "mistral-M" | "mistral-7B";

  const getModelChoice = () => {
    return $("#aiList").val();
  };
  
  const getDishNumber = () => {
    return $("#recipeNb").val();
  };

  let choice = {
    cuisine:"",
    foods:[]
  };

  let elemIdUnique = 0;
  let ongoingAction = false;
  let nbrecipechoice = false;
  let ongoingAjaxCall = false;
  let focusIngredients = true;

  const stdTransitionTime = 30;
  const stdAnimationTime = 400;
  const iconsFolder = "./icons";
  const spinnerElem = "<span class='spinnerArea'><img class='spinnerImg' src='icons/loading.gif'/></span>"
  let allCuisines = [];

  require(["./datas/cuisines", 
            "./datas/foods", 
            "./datas/openaiKey",
            "./datas/mistralKey",
            "./wsutil"],
  function(cuisinesDatas,
            foodsDatas,
            openaiKey,
            mistralKey,
            wsutil){

    $("#aiList").numberselector();

    window.addEventListener('beforeunload', function (e) {
      e.preventDefault();
      e.returnValue = '';
      
      var confirmationMessage = 'Are you sure you want to leave the page?';
      (e || window.event).returnValue = confirmationMessage;
      return confirmationMessage;
    });

    $(".numberselector span").on("click", (evt) => {
      const oldValue = $("#aiList").val();
      const newValue = $(evt.currentTarget).text();

      if (oldValue != newValue){
        const confirmedChange = () => {
          if (newValue == 'mistral-7B') {
            fireSwal(
              'Info', 
              'This model is extremely slow as it runs locally (can take 5-10min to generate 10 dishes).',
              'info',
              'OK'
            )
          }
        }
  
        if (pagestep == 0){
          confirmedChange();
        }
        else {
          fireSwal(
            'Are you sure?', 
            'Do you really want to switch from "' + oldValue +'" to "' + newValue +'" ?',
            'warning', 
            'Yes', 
            'No', 
            (result) => {
              if (result.isConfirmed) {
                confirmedChange();
                // changeStep(0);
              }
              else {
                //rollback
                $("#aiList").val(oldValue);
                $(".numberselector .selected").attr("class", "");
                $(".numberselector [data-attr='"+oldValue+"']").attr("class", "selected");
              }
            }
          );
        }
      }
    });

    $("#resizeArea").on("click", (evt) => {
      if (focusIngredients){
        $("#choosingArea").animate({height:'38.5%'});
        $("#resizeArea").animate({bottom:'47%'});
        $("#answerArea").animate({height:'47%'});
      }
      else{
        $("#choosingArea").animate({height:'58%'});
        $("#resizeArea").animate({bottom:'27.5%'});
        $("#answerArea").animate({height:'27.5%'});
      }

      focusIngredients = !focusIngredients;
    });

    let pagestep = -1;

    let fireSwal = (fstitle, fstext, fsicon, fsconfirmtext, fscanceltext, fsthencb) => {
      Swal.fire({
        title: fstitle,
        text: fstext,
        icon: fsicon,
        showCancelButton: fscanceltext,
        confirmButtonText: fsconfirmtext,
        cancelButtonText: fscanceltext,
      }).then(fsthencb);
    };

    let showToast = (ttext, ttype, hideafter = 5000) => {
      let tbgColor = '#000';
      let ttextColor = '#FFF';
      switch(ttype) {
        case 'info':
          break;
        case 'warning':
          tbgColor = '#FA0';
          break;
        case 'error':
          tbgColor = '#F55';
          ttextColor = '#000';
          break;
      }
      $.toast({
        text :ttext,
        showHideTransition:'fade',
        hideAfter: hideafter,
        bgColor:tbgColor,
        textColor:ttextColor,
        position:'bottom-right',
      })
    };

    let moveElemToSide = (elem, callback, random) => {
      $(elem).fadeOut(stdAnimationTime, () => {
        $("#leftArea").append(elem);
        if (random){
          $(elem).find("img").attr("src", iconsFolder + "/countries/noun-" + random.replace(" ", "-").replace("/", "-").toLowerCase() + ".png")
          $(elem).find(".imgtext").html(random);
        }
        $(elem).fadeIn(stdAnimationTime);
        callback();
      });
    }

    let moveElemToChoosing = (elem, callback) => {
      $(elem).fadeOut(stdAnimationTime, () => {
        $("#choosingArea").append(elem);
        $(elem).fadeIn(stdAnimationTime);
        callback();
      });
    };

    let buildElemItem = (elemClass, elemImg, elemText) => {
      return ({class:elemClass, img:elemImg, text:elemText});
    };

    let setContinentClickEvt = (continentElem) => {
      if (ongoingAction)
        return;
      $(continentElem).on("click", (evt) => {
        let clickedContinent = $(evt.currentTarget).find("span").text();
        changeStep(1, {continent:clickedContinent});
      });
    };

    let setCuisineClickEvt = (cuisineElem) => {
      if (ongoingAction)
        return;
      $(cuisineElem).on("click", (evt) => {
        if (evt.currentTarget.classList.contains('not-allowed'))
          return;
        let isRandom = false;
        let clickedCuisine = $(evt.currentTarget).find("span").text();
        if (clickedCuisine.toLowerCase() == "random"){
          isRandom = true;
          clickedCuisine = allCuisines[Math.floor(Math.random() * allCuisines.length)];
        }
        moveElemToSide(evt.currentTarget, () => {
          choice.cuisine = clickedCuisine;
          changeStep(2, {cuisine:clickedCuisine});
          evt.currentTarget.classList.add("not-allowed");
        }, (isRandom ? clickedCuisine : false));
      });
    };

    let setFoodClickEvt = (foodElem) => {
      if (ongoingAction)
        return;
      $(foodElem).on("click", (evt) => {
        let clickedFood = $(evt.currentTarget).find("span").text();
        if (evt.currentTarget.parentElement.id == "leftArea"){
          moveElemToChoosing(evt.currentTarget, () => {
            if (choice.foods.includes(clickedFood)){
              choice.foods.splice(choice.foods.indexOf(clickedFood), 1);
            }
          });
        }
        else{
          moveElemToSide(evt.currentTarget, () => {
            if (!choice.foods.includes(clickedFood)){
              choice.foods.push(clickedFood);
            }
          });
        }
      });
    };

    let addListOfElementsToChoosing = (elems, clickEvt) => {
      if (ongoingAction)
        return;
        
      ongoingAction = true;
      let extraTime = 0;
      $.each(elems, (index, elem) => {
        setTimeout(() => {
          $("#choosingArea").append("<div id='elemId"+elemIdUnique+"' class='"+elem.class+"' style='display:none'><img src='"+elem.img+"' /><br />"+
          "<span class='imgtext'>"+elem.text+"</span></div>");
          $("div#elemId"+elemIdUnique).fadeIn(stdAnimationTime);
          clickEvt($("#elemId"+elemIdUnique));

          elemIdUnique++;
        }, extraTime);
        extraTime += stdTransitionTime;
      });
      ongoingAction = false;
    };

    let resetChoices = () => {
      if (ongoingAction)
        return;

      choice = {
        cuisine:"",
        foods:[]
      };

      ongoingAction = true;
      let extraTime = 0;
      $.each(Array.from($("#leftArea > div")).reverse(), (index, elem) => {
        setTimeout(() => {
          $(elem).fadeOut(stdAnimationTime, () => {
            $(elem).remove();
          });
        }, extraTime);
        extraTime += stdTransitionTime;
      });
      ongoingAction = false;
    };

    let eraseChoicesElems = () => {
      if (ongoingAction)
        return;

      ongoingAction = true;
      let extraTime = 0;
      $.each(Array.from($("#choosingArea > div")).reverse(), (index, elem) => {
        setTimeout(() => {
          $(elem).fadeOut(stdAnimationTime, () => {
            $(elem).remove();
          });
        }, extraTime);
        extraTime += stdTransitionTime;
      });
      ongoingAction = false;
    };

    let waitForEraseChoicesAndThen = (callback) => {
      setTimeout(() => {
        callback();
      }, $("#choosingArea > div").length * stdTransitionTime + stdAnimationTime);
    };

    let displayContinents = () => {
      eraseChoicesElems();
      waitForEraseChoicesAndThen(() => {
        let continentsElems = [];
        $.each(cuisinesDatas, function(index, value){
          continentsElems.push(buildElemItem("continent",
          iconsFolder + "/continents/noun-" + value.continent.replace(" ", "-").toLowerCase() + ".png",
          value.continent))
        });
        addListOfElementsToChoosing(continentsElems, setContinentClickEvt);
      });
    };

    let displayCuisine = (continent) => {
      eraseChoicesElems();
      waitForEraseChoicesAndThen(() => {
        let cuisineElems = [];
        $.each(cuisinesDatas.filter((item) => {return item.continent === continent})[0].list, function(index, value){
          cuisineElems.push(buildElemItem("cuisine",
          iconsFolder + "/countries/noun-" + value.replace(" ", "-").replace("/", "-").toLowerCase() + ".png",
          value))
        });
        addListOfElementsToChoosing(cuisineElems, setCuisineClickEvt);
      });
    };

    let displayFood = (cuisine) => {
      eraseChoicesElems();
      waitForEraseChoicesAndThen(() => {
        let foodElems = [];
        $.each(foodsDatas.filter((item) => {return item.cuisine === cuisine})[0].list, function(index, value){
          foodElems.push(buildElemItem("food",
          iconsFolder + "/foods/noun-" + value.replace(" ", "-").replace("/", "-").toLowerCase() + ".png",
          value))
        });
        addListOfElementsToChoosing(foodElems, setFoodClickEvt);
      });
    };

    let getRecipeQuery = (dishName) => {
      let query = "";
      if (dishName){
        query += "Few words, not too detailed, keep line breaks and quantities,"+
         "provide a chef recipe with only ingredients and instructions for dish \"" + dishName + "\",no imperial system";
      }
      else{
        
        query += "give me a very short description (that excludes ingredients) of "+getDishNumber()+" dishes inspired by "+choice.cuisine+" cuisine"
        if (choice.foods.length > 0){
          query += ", preferably contains:" + choice.foods.join(",");
        }
        query += ", you must put double line breaks between each dish description";

        switch(getModelChoice()){
          case "gpt":
            // query += "bonus"
            break;
          case "mistral-M":
          case "mistral-7B":
            // query += "bonus"
            break;
        }
      }
      return query;
    };

    let changeStep = (step, options) => {
      if (pagestep != step){
        pagestep = step;
  
        switch(step) {
          case 0:
            resetChoices();
            displayContinents();
            break;
          case 1:
            displayCuisine(options.continent);
            break;
          case 2:
            displayFood(options.cuisine);
            break;
          default:
            break;
        }
      } else {
        if (step == 0){
          showToast("Nothing to reset!", "error");
        }
      }
    };

    let getStringAfterFirstChar = (str, char) => {
      var charIndex = str.indexOf(char);
      if (charIndex !== -1) {
        return str.substring(charIndex + 1);
      } else {
        return "";
      }
    };

    let getDishNameFromEvt = (evt) => {
      let dishDescriptionElem = $(evt.currentTarget.parentElement).find(".dishDescription")[0];
      return getStringAfterFirstChar($(dishDescriptionElem).text().split(":")[0], '.').trim().replace("&", "and");
    };

    let setRecipeListEvents = () => {
      $(".viewDish").on("click", (evt) => {
        let dishName = getDishNameFromEvt(evt);
        let urlToVisit = "https://www.google.com/search?q="+dishName+"&tbm=isch";
        var newTab = window.open(urlToVisit, '_blank');
        newTab.focus();
      });

      $(".viewRecipe").on("click", (evt) => {
        let dishName = getDishNameFromEvt(evt);

        if (ongoingAjaxCall){
          showToast("There's already an ajax call being played, try again after it has completed!", "error");
        }
        else {
          fireSwal(
            'Are you sure?', 
            'Do you REALLY want to ask the following to "' +getModelChoice()+ '":\n"' + getRecipeQuery(dishName) +'"',
            'warning', 
            'Go Ask', 
            'Cancel', 
            (result) => {
              if (result.isConfirmed) {
                showSpinner('#finalRecipeArea');
                sendRequestToModel(getRecipeQuery(dishName), (data) =>{
                  hideSpinner();
                  displayFinalRecipe(getTextFromResponse(data), dishName);
                });
                //wsutil.getDishes(choice.cuisine, choice.foods);
              }
            }
          );
        }
      });
    };

    let setFinalRecipeEvents = (dishName, recipe) => {
      $(".downloadRecipe").on("click", (evt) => {
        downloadRecipe(dishName, recipe);
      });
    };

    let displayAnsweredRecipies = (data) => {
      let toshow = "";
      let recipes = data.split("\n\n");

      $.each(recipes, (index, value) => {
        if (toshow.length > 0)
        {
          toshow += "<br/><br/>"
        }
        toshow += "<span class='dishArea'><img class='viewDish' src='icons/eye.png'/>"+
        "<img class='viewRecipe' src='icons/recipe.png'/><span class='dishDescription'>" + value.replace("\n", ": ") + 
        "</span></span>";
      });

      $('#recipesListArea').html(toshow + "<br/><br/>");

      setRecipeListEvents();
    };

    let displayFinalRecipe = (data, dishName) => {
      let initialValue = "<h3>Recipe for '"+dishName+"'</h3><img src='icons/download.png' class='downloadRecipe'/><br/><br/>";
      let toshow = initialValue;
      let steps = data.split("\n\n");

      $.each(steps, (index, value) => {
        if (toshow != initialValue)
        {
          toshow += "<br/><br/>"
        }
        toshow += "<span class='finalDishStepArea'>" + value.replace(/\n/g, "<br/>") + "</span>";
      });

      $('#finalRecipeArea').html(toshow + "<br/><br/>");

      setFinalRecipeEvents(dishName, toshow.replace(/<br\/>/g, '\n').replace(initialValue, ""));
    };

    let showSpinner = (area) => {
      $(area).html(spinnerElem);
    };

    let hideSpinner = (area) => {
      if (area) {
        $(area).find(".spinnerArea").remove();
      }
      else{
        $(".spinnerArea").remove();
      }
    };

    let getTextFromResponse = (data) => {
      let toret = data.choices[0].message.content;
      if (!toret.includes("\n\n")){
        toret.replace(/\n/g, "\n\n");
      }
      return (toret);
    };

    $("#recipeNb").on("focusin", (evt) => {
      nbrecipechoice = true;
    });

    $("#recipeNb").on("focusout", (evt) => {
      nbrecipechoice = false;
    });

    $("#askBtn").on("click", (evt) => {
      if (ongoingAction || nbrecipechoice)
        return;
      ongoingAction = true;
      if (pagestep < 2){
        showToast("You need to move forward in choosing things before asking for recipe!", "error");
      }
      else{
        if (ongoingAjaxCall){
          showToast("There's already an ajax call being played, try again after it has completed!", "error");
        }
        else {
          fireSwal(
            'Are you sure?', 
            'Do you REALLY want to ask the following to "' +getModelChoice()+ '":\n"' + getRecipeQuery() +'"',
            'warning', 
            'Go Ask', 
            'Cancel', 
            (result) => {
              if (result.isConfirmed) {
                showSpinner('#recipesListArea');
                sendRequestToModel(getRecipeQuery(), (data) =>{
                  hideSpinner();
                  displayAnsweredRecipies(getTextFromResponse(data));
                });
                //wsutil.getDishes(choice.cuisine, choice.foods);
              }
            }
          );
        }
      }
      ongoingAction = false;
    });

    $("#resetBtn").on("click", (evt) => {
      if (ongoingAction)
        return;
      changeStep(0);
    });

    $("#historyBtn").on("click", (evt) => {
      if (ongoingAction)
        return;
      openHistoryModal();
    });

    $("#closemyoverlay").on("click", (evt) => {
      $(document.getElementById('myoverlay')).fadeOut(stdAnimationTime);
    });

    let lastClickedRecipe = null;

    let openHistoryModal = () => {
      $(document.getElementById('myoverlay')).fadeIn(stdAnimationTime, () => {
        wsutil.wscallback = (data) => {
          let overcontent = document.getElementById("myoverlay-real-content");
          overcontent.innerHTML = "";

          for (const key in data.data) {
            let recipe = JSON.stringify(data.data[key]).replace(/\\n/g, "<br/>");
            overcontent.innerHTML += ("<div class='historyrecipe'><span class='historyrecipe-dish'>" + key + "</span><span class='historyrecipe-recipe'><br/>" +
              recipe + "<br/></span></div><hr/>");
          }

          $(".historyrecipe-dish").on("click", function (evt) {
            $(".historyrecipe-recipe").hide();
            let recipeElem = $(this.parentElement).find(".historyrecipe-recipe")[0];
            if (lastClickedRecipe == recipeElem){
              lastClickedRecipe = null;
            }
            else{
              recipeElem.style.display = 'block';
              lastClickedRecipe = recipeElem;
            }
          });
        };
        wsutil.getHistory(true);
      });
    };

    let loadAllCuisines = () => {
      allCuisines = [];
      $.each(cuisinesDatas, (index, value) => {
        allCuisines = allCuisines.concat(value.list);
      });
      allCuisines.splice(allCuisines.indexOf("Random"), 1);
    };

    let sendRequestToModel = (request, callbackSuccess) => {
      switch(getModelChoice()){
        case "gpt":
          sendRequestToGPT(request, callbackSuccess);
          break;
        case "mistral-M":
          sendRequestToMistral(request, callbackSuccess, "medium");
          break;
        case "mistral-7B":
          sendRequestToMistral(request, callbackSuccess, "local");
          break;
      }
    }

    let sendRequestToMistral = (request, callbackSuccess, mistralmodel = "medium") => {
      console.log("Sending to Mistral:", request);
      ongoingAjaxCall = true;

      let dataToSend = {
        "model": "mistral-medium",
        "messages": [
            {
                "role": "user",
                "content": request
            }
        ],
        "temperature": 0.9,
        "top_p": 0.5,
        "max_tokens": 700
      };

      switch(mistralmodel){
        case "medium":
          // dataToSend.temperature = 0;
          break;
        case "local":
          // dataToSend.temperature = 0;
          break;
        default:
          break;
      }

      let urlapicall = "";

      switch(mistralmodel){
        case "medium":
          urlapicall = "https://api.mistral.ai/v1/chat/completions";
          break;
        case "local":
          urlapicall = "http://localhost:2666/v1/chat/completions";
          break;
        default:
          break;
      }

      $.ajax({
        url: urlapicall,
        type: 'POST',
        dataType: "json",
        contentType : 'application/json',
        beforeSend: function (xhr) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + mistralKey);
        },
        data: JSON.stringify(dataToSend),
        success: (data) => {
          console.log("Ajax Call Success:", data);
          if(callbackSuccess)
            callbackSuccess(data);
        },
        error: (data) => {
          console.log("Ajax Call Failure:", data);
          hideSpinner();
          showToast("Ajax call to mistral failed: check logs and eventually try to send your request again.", "error", 10000);
        },
        complete: () => {
          ongoingAjaxCall = false;
        }
      });
    };

    let sendRequestToGPT = (request, callbackSuccess, gptmodel = "gpt-4") => {
      console.log("Sending to gpt:", request);
      ongoingAjaxCall = true;

      let dataToSend = {
        "model": gptmodel,
        "messages": [{role: "user", content: request}],
        "max_tokens": 700,
        "temperature": 0.9,
        "frequency_penalty": 0.8,
        "presence_penalty": 0.8
      };

      switch(gptmodel){
        case "gpt-3.5-turbo":
          // dataToSend.temperature = 0;
          break;
        case "gpt-4":
          // dataToSend.temperature = 0;
          break;
        default:
          break;
      }

      $.ajax({
        url: "https://api.openai.com/v1/chat/completions",
        type: 'POST',
        dataType: "json",
        contentType : 'application/json',
        beforeSend: function (xhr) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + openaiKey);
        },
        data: JSON.stringify(dataToSend),
        success: (data) => {
          console.log("Ajax Call Success:", data);
          if(callbackSuccess)
            callbackSuccess(data);
        },
        error: (data) => {
          console.log("Ajax Call Failure:", data);
          hideSpinner();
          showToast("Ajax call to openai failed: check logs and eventually try to send your request again.", "error", 10000);
        },
        complete: () => {
          ongoingAjaxCall = false;
        }
      });
    };

    wsutil.initialize({address:"localhost",port:3729}).then(() => {
      $("#historyBtn").show();
    });
    loadAllCuisines();
    changeStep(0);
  });

  const downloadRecipe = (dishName, recipe) => {
    const link = document.createElement("a");
    const content = recipe;
    const file = new Blob([content], { type: 'text/plain' });
    link.href = URL.createObjectURL(file);
    link.download = dishName + "-" + (new Date()).toISOString().split('T')[0] + ".recipe.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

});
