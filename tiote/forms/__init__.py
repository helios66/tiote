from django import forms
from django.core import validators
from django.utils.datastructures import SortedDict

from tiote.utils import *
# children modules (in files) of this module
from common import *
from pgsql import *
from mysql import *


class InsertForm(forms.BaseForm):
    '''
    Dynamically created form which generates its fields along with the fields' options
    from its parameters. 

    Does not make use of metaclasses so it subclasses forms.BaseForm directly.

    It loops through the parameter ``tbl_struct``(the structure of a table) and then generates
    fiels which would fit the description of respective columns

    It also treats some fields specially as defined in ``tbl_indexes`` and the form's ``dialect``
    '''

    def __init__(self, dialect, tbl_struct, tbl_indexes=(), **kwargs):
# keys = ['column','type','null','default','character_maximum_length','numeric_precision', 'extra','column_type']
        f = SortedDict()
        # dict to increase performance
        indexed_cols = fns.parse_indexes_query(tbl_indexes)
        
        # determing type of form fields for each column
        for row in tbl_struct['rows']:
            _classes = []

            if row[1] in ('character varying', 'varchar','character', 'char'):
                f[row[0]] = forms.CharField()
                # if row[4]: f[row[0]].max_length = row[4] #max_length

            elif row[1] in ('varbinary', 'bit', 'bit varying',):
                f[row[0]] = forms.CharField()
                # if row[4]: f[row[0]].max_length = row[4] #max_length

            elif row[1] in ('text', 'tinytext', 'mediumtext', 'longtext', ):
                f[row[0]] = forms.CharField(widget=forms.Textarea(attrs={'cols':'', 'rows':''}))
                # if row[4]: f[row[0]].max_length = row[4] #max_length

            elif row[1] in ('boolean', ):
                f[row[0]] = forms.BooleanField(
                    required=False # so it can accept 'True' and 'False', not just 'True'
                    )

            elif row[1] in ('tinyint', 'smallint', 'mediumint', 'int', 'bigint','integer',):
                f[row[0]] = forms.IntegerField()
                # if row[5]: f[row[0]].validators.append(validators.MaxLengthValidator(row[5]))
                _classes.append('validate-integer')
                
            elif row[1] in ('real', 'double', 'float', 'decimal', 'numeric', 'double precision'):
                f[row[0]] = forms.FloatField()
                # if row[5]: f[row[0]].validators.append(validators.MaxLengthValidator(row[5]))
                _classes.append('validate-numeric')

            elif row[1] in ('decimal', 'numeric', 'money',):
                f[row[0]] = forms.DecimalField()
                # if row[5]: f[row[0]].validators.append(validators.MaxLengthValidator(row[5]))
                _classes.append('validate-numeric')

            elif row[1] in ('date',):
                f[row[0]] = forms.DateField()
                _classes.append('validate-date')

            elif row[1] in ('datetime', 'time','time with time zone','timestamp', 'timestamp with time zone',):
                # no longer used a python field (date, datetime) because
                # - of error generated when submitting fields which
                # - are populated from the database
                f[row[0]] = forms.CharField() 
                
            elif row[1] == 'set':
                f[row[0]] = forms.MultipleChoiceField(widget=tt_CheckboxSelectMultiple())
                # parse the field description to list with all the unnecssary quotes removed
                choices = row[len(row)-1].replace("set(", "").replace(")","")
                choices = choices.replace("'", "").split(",")
                f[row[0]].choices = fns.make_choices(choices, True) 

            elif row[1] == 'enum':
                f[row[0]] = forms.ChoiceField()
                # parse the field description to list with all the unnecssary quotes removed
                choices = row[len(row)-1].replace("enum(", "").replace("\"","").replace(")","")
                choices = choices.replace("'", "").split(",")
                f[row[0]].choices = fns.make_choices(choices, False) 
            
            # any field not currently understood (PostgreSQL makes use of a lot of user defined fields
                # which is difficult to keep track of)
            else: f[row[0]] = forms.CharField(widget=forms.Textarea(attrs={'cols':'', 'rows':''}))

            #required fields
            if row[2].lower() == 'no' or row[2] == False:
                # the field row[2] is required
                _classes.append("required")
                # the option  above must be the last assignment to _classes because it's index
                # - must be the last one for the next lines of logic to work
            else:
                f[row[0]].required = False
                
            # options common to all fields
            # help_text
            _il = [ row[len(row) - 1], ]
            if dialect == 'mysql': _il.append(row[len(row) -2 ])
            f[row[0]].help_text =  " ".join(_il)
            if row[3]: f[row[0]].default = row[3] #default
            
            # work with indexes
            if indexed_cols.has_key( row[0] ):
                if dialect == 'mysql' and indexed_cols[ row[0] ].count("PRIMARY KEY"):
                    # make an indexed column with auto_increment flag not required (MySQL)
                    if row[len(row) - 2].count('auto_increment') > 0: 
                        if _classes.count('required') > 0: _classes.pop()
                        f[ row[0] ].required = False

            # width of the fields
            if type(f[row[0]].widget) not in (forms.CheckboxSelectMultiple, tt_CheckboxSelectMultiple,):
                _classes.append("span6")
            # add the attribute classes                
            if f[row[0]].widget.attrs.has_key('class'):
                f[row[0]].widget.attrs['class'] += " ".join(_classes)
            else:
                f[row[0]].widget.attrs.update({'class':" ".join(_classes)})


        self.base_fields = f
        forms.BaseForm.__init__(self, **kwargs)


class EditForm(InsertForm):
    '''
    Subclasses InsertForm to include the dynamic property of InsertForm as well as to 
    add and option that specifies if the request would be for a new row or would be 
    an update for that row
    '''

    def __init__(self, dialect, tbl_struct, tbl_indexes=(), **kwargs):
        InsertForm.__init__(self, dialect, tbl_struct, tbl_indexes, **kwargs)

        # working with self.fields attribute because this is an instance of InsertForm
        # - and not a whole form class definition
        self.fields['save_changes_to'] = forms.ChoiceField(
            label = 'save changes to',
            choices = (('update_row', 'Same row (UPDATE statment)',),
                ('insert_row', 'Another row (INSERT statement)')
            ), 
            initial = 'update_row',
            widget = forms.RadioSelect(attrs={'class':'inputs-list'}, renderer = tt_RadioFieldRenderer)
        )


    
class LoginForm(forms.BaseForm):
    
    def __init__(self, templates=None, choices="a", charsets=None, **kwargs):
        f = SortedDict()
        # choices = "a" || all choices
        # choices = "m" || mysql dialect
        # , 
        # choices = "p" || postgresql dialect
        database_choices = [ ('', 'select database driver'),]
        if choices == "p" or choices == "a":
            database_choices.append(('postgresql', 'PostgreSQL'))
        if choices == "m" or choices == "a":
            database_choices.append(('mysql', 'MySQL'))
        f['host'] = forms.CharField(
            initial = 'localhost', widget=forms.TextInput(attrs=({'class':'required'}))
        )
        f['username'] = forms.CharField(
            widget=forms.TextInput(attrs=({'class':'required'}))
        )
        f['password'] = forms.CharField(
            widget = forms.PasswordInput,
            required = False,
        )
        f['database_driver'] = forms.ChoiceField(
            choices = database_choices,
            widget = forms.Select(attrs={
    #            'class':'select_requires:connection_database:postgresql'
                'class':'required'
                    }
            ),
        )
        f['connection_database'] = forms.CharField(
            required=False, 
            help_text='Optional but needed if the PostgreSQL installation does not include the default `postgres` database'
        )
        self.base_fields = f
        forms.BaseForm.__init__(self, **kwargs)



class QueryForm(forms.Form):
    query = forms.CharField(label = u"Enter your query:", 
        widget = forms.Textarea(attrs={'class':'required span10','rols':0, 'cols':0, 'style':'height:100px;resize:none;'},) )


def get_dialect_form(form_cls, dialect):
    '''
    structure of dialect_forms:
        { 'form_cls': [ postgresql version of form_cls, mysql version of form_cls] }
    '''
    dialect_forms = {
        'DbForm': [pgsqlDbForm, mysqlDbForm],
        'UserForm': [pgsqlUserForm, mysqlUserForm],
        'TableForm': [pgsqlTableForm, mysqlTableForm],
    }
    
    return dialect_forms[form_cls][0] if dialect == 'postgresql' else dialect_forms[form_cls][1]
